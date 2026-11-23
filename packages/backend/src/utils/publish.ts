import { randomInt } from 'crypto'
import { Offer } from '@prisma/client'
import { prisma } from './prisma'
import { sendPhoto, sendMessage } from '../channels/telegram'
import { isWhatsAppEnabled, isWhatsAppConnected, sendWhatsAppPost } from '../channels/whatsapp'
import { queueIndexNow } from './indexnow'
import { isHype, HYPE_PRIORITY_BONUS } from './hype'

// Publicação única para Telegram + WhatsApp: os dois canais recebem a MESMA oferta,
// com o link curto do site (/r/{code}) no lugar do link de afiliado cheio.

export const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://foxpromocoes.vercel.app').replace(/\/$/, '')

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/l/I

function randomCode(len = 6): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

export function shortLink(code: string): string {
  return `${SITE_URL}/r/${code}`
}

// Gera (uma vez) o código curto da oferta; reaproveita se já existir
export async function ensureShortCode(externalId: string): Promise<string> {
  const offer = await prisma.offer.findUnique({ where: { externalId }, select: { shortCode: true } })
  if (offer?.shortCode) return offer.shortCode
  for (let i = 0; i < 5; i++) {
    const code = randomCode()
    try {
      await prisma.offer.update({ where: { externalId }, data: { shortCode: code } })
      return code
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err // colisão de unique: tenta outro
    }
  }
  throw new Error('Não foi possível gerar shortCode')
}

// Troca o link de afiliado (cru ou com &amp; do HTML) pelo link curto — cobre copies antigos
export function withShortLink(message: string, offer: Pick<Offer, 'affiliateUrl'>, code: string): string {
  const short = shortLink(code)
  const raw = offer.affiliateUrl
  return message
    .split(raw.replace(/&/g, '&amp;')).join(short).split(raw).join(short)
    // copy gerado antes da troca de domínio: atualiza o link curto para o SITE_URL atual
    .replace(new RegExp(`https?://[^\\s"'<>]+/r/${code}\\b`, 'g'), short)
}

// Amazon devolve miniatura 226px no /deals; pede a versão grande
export function bestImage(url: string | null): string | null {
  if (!url) return null
  if (/m\.media-amazon\.com\/images\//.test(url)) return url.replace(/\._[^/]+_\.(jpg|jpeg|png|webp)$/i, '._AC_SL1000_.$1')
  return url
}

// Remove título duplicado ("Produto X 127VProduto X 127V…") vindo de elementos aninhados
export function cleanTitle(title: string): string {
  let t = title.trim()
  const head = t.slice(0, 30)
  if (head.length >= 30) {
    const again = t.indexOf(head, 30)
    if (again > 0) t = t.slice(0, again).trim()
  }
  return t
}

// Ticket baixo converte mais (compra por impulso): pesa o preço na fila de posting
// Ofertas vindas dos canais do Telegram (source 'telegram') furam a fila: já foram
// garimpadas por gente e expiram rápido.
export const TELEGRAM_SOURCE_BONUS = 6
export const TELEGRAM_SOURCE_MAX_AGE_HOURS = 6

// Produtos hype (console, GTA, peça de PC) ganham +3: compensam o ticket alto
export function postPriority(o: Pick<Offer, 'aiScore' | 'salePrice' | 'discountPct'> & { source?: string; title?: string }): number {
  const p = o.salePrice
  const priceBonus = p <= 50 ? 3 : p <= 100 ? 2.5 : p <= 200 ? 2 : p <= 400 ? 1 : p <= 1000 ? 0 : p <= 2000 ? -2 : -4
  const discountBonus = o.discountPct >= 40 ? 0.5 : 0
  const sourceBonus = o.source === 'telegram' ? TELEGRAM_SOURCE_BONUS : 0
  const hypeBonus = o.title && isHype(o.title) ? HYPE_PRIORITY_BONUS : 0
  // PS5 (console) abaixo de R$4.000 é preço realmente bom: fura a fila
  const ps5Bonus = o.title && /(ps5|playstation\s*5)/i.test(o.title) && /console|slim|pro|digital|disco|disk|1tb|2tb/i.test(o.title) && !/controle|jogo|game|volante|headset|fone/i.test(o.title) && p < 4000 ? 3 : 0
  return (o.aiScore ?? 0) + priceBonus + discountBonus + sourceBonus + hypeBonus + ps5Bonus
}

function inPostingHours(): boolean {
  const [start, end] = (process.env.POST_HOURS || process.env.WHATSAPP_HOURS || '8-23').split('-').map(Number)
  const hour = new Date().getHours()
  return hour >= start && hour < end
}

export function canPostNow(): boolean {
  return inPostingHours()
}

let lastWhatsAppAt = 0

// Posta a oferta nos dois canais (WhatsApp só se habilitado e conectado).
// telegramText/whatsappText permitem repost com copy novo; default = copy salvo.
export async function publishOffer(
  offer: Offer,
  opts: { telegramText?: string; whatsappText?: string; repost?: boolean } = {}
): Promise<{ telegram: boolean; whatsapp: boolean | null }> {
  const code = await ensureShortCode(offer.externalId)
  const image = bestImage(offer.imageUrl)
  const tgText = withShortLink(opts.telegramText ?? offer.telegramMessage ?? '', offer, code)
  const waText = withShortLink(opts.whatsappText ?? offer.whatsappMessage ?? '', offer, code)
  const repostedAt = opts.repost ? new Date() : undefined

  let telegram = false
  if (tgText) {
    telegram = image ? await sendPhoto(image, tgText) : await sendMessage(tgText)
    await prisma.post.create({ data: { offerId: offer.id, channel: 'telegram', message: tgText, whatsappMessage: waText || null, success: telegram, repostedAt } })
  }

  let whatsapp: boolean | null = null
  if (waText && isWhatsAppEnabled()) {
    if (!isWhatsAppConnected()) {
      console.warn('[Publish] WhatsApp desconectado — oferta só no Telegram')
    } else {
      // Baileys é não oficial: espaça os envios (20–40s) para não parecer spam
      const gap = 20000 + Math.random() * 20000 - (Date.now() - lastWhatsAppAt)
      if (gap > 0) await new Promise(r => setTimeout(r, gap))
      whatsapp = await sendWhatsAppPost(waText, image)
      lastWhatsAppAt = Date.now()
      await prisma.post.create({ data: { offerId: offer.id, channel: 'whatsapp', message: waText, whatsappMessage: waText, success: whatsapp, repostedAt } })
    }
  }

  if (!opts.repost && (telegram || whatsapp)) queueIndexNow(`/oferta/${offer.id}`)
  console.log(`[Publish] "${offer.title.slice(0, 60)}" R$${offer.salePrice} — telegram:${telegram} whatsapp:${whatsapp}`)
  return { telegram, whatsapp }
}
