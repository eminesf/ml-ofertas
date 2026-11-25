import { Offer } from '@prisma/client'
import { prisma } from './prisma'
import { TELEGRAM_SOURCE_MAX_AGE_HOURS } from './publish'
import { leilaoEmAndamentoOuProximo } from './leilao-guard'
import { extractAmazonHtml } from '../providers/amazon/scraper-product'
import { extractAsin } from '../providers/amazon'

// Validade de uma oferta na fila de posting, contada da última vez que o preço foi
// visto (Offer.priceSeenAt — scrape, feed ou fonte; createdAt para as antigas).
// Motivo (25/11/2026): a fila chegou a ~460 aprovadas para ~90 posts/dia e saíam
// jogos de PS5 da KaBuM a R$157 que já tinham voltado a R$384 no feed.
const env = (k: string, d: number) => parseFloat(process.env[k] || '') || d
const FEED_PROVIDERS = new Set(['kabum', 'nike', 'stanley'])

export function maxAgeHours(o: Pick<Offer, 'provider' | 'source'>): number {
  if (o.source === 'telegram') return TELEGRAM_SOURCE_MAX_AGE_HOURS // fontes: 3h
  if (o.source === 'coupon' || o.source === 'manual') return env('QUEUE_MAX_AGE_COUPON_HOURS', 48)
  if (o.provider === 'kabum') return env('QUEUE_MAX_AGE_FLASH_HOURS', 12) // queda de preço no feed = relâmpago
  if (o.provider === 'nike' || o.provider === 'stanley') return env('QUEUE_MAX_AGE_BRAND_HOURS', 48)
  return env('QUEUE_MAX_AGE_HOURS', 24) // ML, Amazon, Shopee, hub
}

export function priceSeenAt(o: Pick<Offer, 'priceSeenAt' | 'createdAt'>): Date {
  return o.priceSeenAt ?? o.createdAt
}

export function isFresh(o: Pick<Offer, 'provider' | 'source' | 'priceSeenAt' | 'createdAt'>, now = Date.now()): boolean {
  return now - priceSeenAt(o).getTime() <= maxAgeHours(o) * 3600_000
}

// Confere o preço logo antes de postar. Só barra quando TEM certeza de que subiu
// (> 5%); se não der para conferir, deixa passar (a validade acima já limita o risco).
//  - KaBuM/Nike/Stanley: último preço do feed Awin (tabela FeedPrice), sem rede
//  - Amazon: fetch HTTP da página (sem Playwright); pulado durante leilão do bot-leilao
//  - ML/Shopee: sem conferência barata (captcha/bloqueio) — vale só a validade
export async function checkPriceBeforePost(o: Offer): Promise<{ ok: boolean; reason?: string; price?: number }> {
  if (o.source === 'telegram' || o.source === 'manual') return { ok: true }
  const limit = o.salePrice * 1.05
  try {
    if (FEED_PROVIDERS.has(o.provider)) {
      const fp = await prisma.feedPrice.findUnique({ where: { externalId: o.externalId } })
      if (fp && fp.price > limit) return { ok: false, price: fp.price, reason: `feed agora R$${fp.price}` }
      return { ok: true }
    }
    if (o.provider === 'amazon' && !leilaoEmAndamentoOuProximo()) {
      const asin = extractAsin(o.productUrl)
      if (!asin) return { ok: true }
      const res = await fetch(`https://www.amazon.com.br/dp/${asin}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return { ok: true }
      const html = await res.text()
      if (/captcha|robot check/i.test(html)) return { ok: true }
      const data = extractAmazonHtml(html)
      if (data && data.salePrice > limit) return { ok: false, price: data.salePrice, reason: `Amazon agora R$${data.salePrice}` }
      if (data) await prisma.offer.update({ where: { id: o.id }, data: { priceSeenAt: new Date() } }).catch(() => {})
    }
  } catch (err: any) {
    console.warn(`[Fila] conferência de preço falhou (${o.externalId}): ${err?.message} — segue`)
  }
  return { ok: true }
}

// Tira da fila (sem apagar): sem copy ela não volta a ser candidata; se o preço cair
// de novo, o próximo scrape/feed muda o preço e o processOffer reavalia e gera copy nova.
export async function dropFromQueue(o: Offer, reason: string) {
  await prisma.offer.update({ where: { id: o.id }, data: { telegramMessage: null, whatsappMessage: null } })
  console.log(`[Fila] "${o.title.slice(0, 60)}" saiu da fila: ${reason} (era R$${o.salePrice})`)
}
