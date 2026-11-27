import { randomInt } from 'crypto'
import { Offer } from '@prisma/client'
import { prisma } from './prisma'
import { sendPhoto, sendMessage } from '../channels/telegram'
import { isWhatsAppEnabled, isWhatsAppConnected, sendWhatsAppPost } from '../channels/whatsapp'
import { queueIndexNow } from './indexnow'
import { isHype, HYPE_PRIORITY_BONUS } from './hype'
import { groupByKey, offerGroup } from './groups'

// Publicação única para Telegram + WhatsApp: os dois canais recebem a MESMA oferta,
// com o link curto do site (/r/{code}) no lugar do link de afiliado cheio.

export const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://foxpromocoes.vercel.app').replace(/\/$/, '')

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/l/I

function randomCode(len = 6): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

// src marca a origem do clique (painel de análise): 't' canal do Telegram,
// 'w' grupo Tech & TCG, 'a' grupo Achadinhos. Sem src = site.
export type ClickSrc = 't' | 'w' | 'a'
export function shortLink(code: string, src?: ClickSrc): string {
  return `${SITE_URL}/r/${code}${src ? `?${src}` : ''}`
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
export function withShortLink(message: string, offer: Pick<Offer, 'affiliateUrl'>, code: string, src?: ClickSrc): string {
  const short = shortLink(code, src)
  const raw = offer.affiliateUrl
  return message
    .split(raw.replace(/&/g, '&amp;')).join(short).split(raw).join(short)
    // link curto já no texto (domínio antigo ou outra origem): troca pelo atual, sem duplicar o ?src
    .replace(new RegExp(`https?://[^\\s"'<>?]+/r/${code}(\\?[a-z]\\b)?`, 'g'), short)
}

// Nome da loja no post (25/11/2026: o dono quer que o grupo saiba onde é a compra).
// Entra na hora do envio, antes da linha do link (👉) — vale para o que já está na fila.
// Pula se o texto já diz a loja ("Loja:", "🏪", "na Amazon"…).
const STORE_NAMES: Record<string, string> = {
  mercadolivre: 'Mercado Livre', amazon: 'Amazon', shopee: 'Shopee', kabum: 'KaBuM!',
  aliexpress: 'AliExpress', stanley: 'Stanley (site oficial)', nike: 'Nike (site oficial)',
}
export function withStoreLine(message: string, provider: string, html: boolean): string {
  const name = STORE_NAMES[provider]
  if (!message || !name) return message
  const base = name.replace(/ \(.*\)$/, '').replace('!', '')
  if (/🏪|\bloja:/i.test(message) || new RegExp(`\\b(na|no|da|do) ${base}\\b`, 'i').test(message)) return message
  const lines = message.split('\n')
  const at = lines.findIndex(l => l.includes('👉'))
  if (at < 0) return message
  const indent = lines[at].match(/^\s*/)?.[0] ?? ''
  // Respiro: linha em branco antes da loja e antes do link (26/11/2026 — texto "muito junto")
  let start = at
  while (start > 0 && !lines[start - 1].trim()) start--
  lines.splice(start, at - start, '', `${indent}🏪 Loja: ${html ? `<b>${name}</b>` : `*${name}*`}`, '')
  return lines.join('\n')
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
export const TELEGRAM_SOURCE_MAX_AGE_HOURS = parseInt(process.env.TELEGRAM_SOURCE_MAX_AGE_HOURS || '3', 10)

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

// POST_24H_UNTIL (ISO, ex. 2026-11-30T08:00:00-03:00): posting 24h até essa data
// (Black Friday). Depois volta sozinho para POST_HOURS.
function in24hWindow(): boolean {
  const until = Date.parse(process.env.POST_24H_UNTIL || '')
  return Number.isFinite(until) && Date.now() < until
}

function inPostingHours(): boolean {
  if (in24hWindow()) return true
  const [start, end] = (process.env.POST_HOURS || process.env.WHATSAPP_HOURS || '8-23').split('-').map(Number)
  const hour = new Date().getHours()
  return hour >= start && hour < end
}

export function canPostNow(): boolean {
  return inPostingHours()
}

// Baileys é não oficial: TODOS os envios do número (os dois grupos) passam por uma
// fila única, com 20–40s entre mensagens, para não parecer spam
let lastWhatsAppAt = 0
let waLine: Promise<unknown> = Promise.resolve()
export function inWhatsAppLine<T>(send: () => Promise<T>): Promise<T> {
  const run = waLine.then(async () => {
    const gap = 20000 + Math.random() * 20000 - (Date.now() - lastWhatsAppAt)
    if (gap > 0) await new Promise(r => setTimeout(r, gap))
    try {
      return await send()
    } finally {
      lastWhatsAppAt = Date.now()
    }
  })
  waLine = run.catch(() => {})
  return run
}

// Posta a oferta nos dois canais (WhatsApp só se habilitado e conectado).
// telegramText/whatsappText permitem repost com copy novo; default = copy salvo.
export async function publishOffer(
  offer: Offer,
  opts: { telegramText?: string; whatsappText?: string; repost?: boolean } = {}
): Promise<{ telegram: boolean; whatsapp: boolean | null }> {
  // Trava contra post duplo: envio imediato (fonte Telegram / botão do admin) e o
  // posting de 20 em 20 min podem pegar a mesma oferta ao mesmo tempo
  if (!opts.repost) {
    if (publishing.has(offer.id) || (await prisma.post.count({ where: { offerId: offer.id } })) > 0) {
      console.log(`[Publish] ${offer.id} já postada/em envio — pulando`)
      return { telegram: false, whatsapp: null }
    }
    publishing.add(offer.id)
  }
  try {
    return await doPublish(offer, opts)
  } finally {
    if (!opts.repost) publishing.delete(offer.id)
  }
}

const publishing = new Set<string>()

async function doPublish(
  offer: Offer,
  opts: { telegramText?: string; whatsappText?: string; repost?: boolean }
): Promise<{ telegram: boolean; whatsapp: boolean | null }> {
  const code = await ensureShortCode(offer.externalId)
  const image = bestImage(offer.imageUrl)
  // WhatsApp: cada oferta vai para UM grupo (Tech & TCG ou Achadinhos — utils/groups.ts)
  const group = groupByKey(offerGroup(offer))
  const tgText = withStoreLine(withShortLink(opts.telegramText ?? offer.telegramMessage ?? '', offer, code, 't'), offer.provider, true)
  const waText = withStoreLine(withShortLink(opts.whatsappText ?? offer.whatsappMessage ?? '', offer, code, group.key === 'tech' ? 'w' : 'a'), offer.provider, false)
  const repostedAt = opts.repost ? new Date() : undefined
  // Preço/cupom do momento: na próxima vez que o produto aparecer, dá para ver se é promoção nova
  const snap = { price: offer.sourcePrice ?? offer.salePrice, couponCode: offer.couponCode }

  let telegram = false
  if (tgText) {
    telegram = image ? await sendPhoto(image, tgText) : await sendMessage(tgText)
    await prisma.post.create({ data: { offerId: offer.id, channel: 'telegram', message: tgText, whatsappMessage: waText || null, success: telegram, repostedAt, ...snap } })
  }

  const groupJid = group.jid()
  let whatsapp: boolean | null = null
  if (waText && isWhatsAppEnabled() && groupJid?.endsWith('@g.us')) {
    if (!isWhatsAppConnected()) {
      console.warn('[Publish] WhatsApp desconectado — oferta só no Telegram')
    } else {
      whatsapp = await inWhatsAppLine(() => sendWhatsAppPost(waText, image, groupJid))
      await prisma.post.create({ data: { offerId: offer.id, channel: group.channel, message: waText, whatsappMessage: waText, success: whatsapp, repostedAt, ...snap } })
    }
  }

  if (!opts.repost && (telegram || whatsapp)) queueIndexNow(`/oferta/${offer.id}`)
  console.log(`[Publish] "${offer.title.slice(0, 60)}" R$${offer.salePrice} — telegram:${telegram} whatsapp[${group.key}]:${whatsapp}`)
  return { telegram, whatsapp }
}
