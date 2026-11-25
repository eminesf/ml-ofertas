import { RawOffer } from '../base.provider'
import { fetchGenericProduct } from '../html-product'
import { extractAsin } from './index'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// Seletores clássicos da página de produto da Amazon como primeira tentativa —
// a Amazon não usa JSON-LD Product de forma consistente no BR.
export function extractAmazonHtml(html: string): { title: string; salePrice: number; originalPrice: number; imageUrl?: string; rating?: number } | null {
  const titleM = html.match(/<span[^>]+id="productTitle"[^>]*>([\s\S]*?)<\/span>/)
  const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim() : ''

  // preço atual: primeiro .a-offscreen dentro do bloco de preço principal
  let salePrice = 0
  const offscreen = [...html.matchAll(/<span[^>]+class="[^"]*a-offscreen[^"]*"[^>]*>R\$\s?([\d.]+,\d{2})<\/span>/g)]
  if (offscreen.length > 0) {
    salePrice = parseFloat(offscreen[0][1].replace(/\./g, '').replace(',', '.'))
  }

  // preço original: "basisPrice" / preço riscado
  let originalPrice = salePrice
  const basisM = html.match(/class="[^"]*a-text-price[^"]*"[^>]*>\s*<span[^>]+class="[^"]*a-offscreen[^"]*"[^>]*>R\$\s?([\d.]+,\d{2})/)
  if (basisM) {
    const op = parseFloat(basisM[1].replace(/\./g, '').replace(',', '.'))
    if (op > salePrice) originalPrice = op
  }

  const imgM = html.match(/"hiRes":"(https:[^"]+)"/) || html.match(/<img[^>]+id="landingImage"[^>]+src="([^"]+)"/)
  const imageUrl = imgM ? imgM[1] : undefined

  const ratingM = html.match(/([\d,.]+) de 5 estrelas/)
  const rating = ratingM ? parseFloat(ratingM[1].replace(',', '.')) || undefined : undefined

  if (!title || salePrice <= 0) return null
  return { title, salePrice, originalPrice, imageUrl, rating }
}

export async function scrapeAmazonProduct(url: string): Promise<RawOffer | null> {
  const asin = extractAsin(url)
  if (!asin) {
    console.error('[Amazon] ASIN não encontrado na URL:', url)
    return null
  }
  const cleanUrl = `https://www.amazon.com.br/dp/${asin}`
  const externalId = `AMZN-${asin}`

  // Caminho 1: fetch HTTP com seletores próprios da Amazon
  try {
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (res.ok) {
      const html = await res.text()
      if (!/captcha|robot check/i.test(html)) {
        const data = extractAmazonHtml(html)
        if (data) {
          console.log(`[Amazon] Fetch HTTP OK: "${data.title}" R$${data.salePrice}`)
          const discountPct = data.originalPrice > data.salePrice
            ? Math.round((1 - data.salePrice / data.originalPrice) * 100)
            : 0
          return { externalId, productUrl: cleanUrl, discountPct, ...data }
        }
      } else {
        console.warn('[Amazon] Fetch HTTP recebeu robot-check')
      }
    }
  } catch (e) {
    console.warn('[Amazon] Fetch HTTP falhou:', (e as Error).message)
  }

  // Caminho 2: extração genérica (og meta / JSON-LD) com fallback Playwright
  const generic = await fetchGenericProduct(cleanUrl)
  if (!generic) return null
  const discountPct = generic.originalPrice > generic.salePrice
    ? Math.round((1 - generic.salePrice / generic.originalPrice) * 100)
    : 0
  return { externalId, productUrl: cleanUrl, discountPct, ...generic }
}
