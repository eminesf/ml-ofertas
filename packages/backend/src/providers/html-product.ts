import { chromium } from 'playwright'

// Dados genéricos extraídos de qualquer página de produto via JSON-LD + og: meta.
// Usado pelos providers Awin (Kabum/AliExpress/Stanley) e Shopee, e como
// fallback genérico — cada provider complementa com seletores próprios se precisar.
export interface GenericProductData {
  title: string
  salePrice: number
  originalPrice: number
  imageUrl?: string
  rating?: number
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

function parsePrice(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return 0
  // aceita "1.234,56", "1234.56" e "R$ 1.234,56"
  const cleaned = value.replace(/[^\d.,]/g, '')
  if (!cleaned) return 0
  const brFormat = /,\d{1,2}$/.test(cleaned)
  const normalized = brFormat
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '')
  return parseFloat(normalized) || 0
}

function extractFromHtml(html: string): GenericProductData | null {
  let title = ''
  let salePrice = 0
  let originalPrice = 0
  let imageUrl = ''
  let rating: number | undefined

  // 1) JSON-LD Product
  const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const m of ldMatches) {
    try {
      const data = JSON.parse(m[1].trim())
      const items: any[] = Array.isArray(data) ? data : [data]
      // @graph aninhado também é comum
      const flat = items.flatMap((i: any) => (i && i['@graph'] ? i['@graph'] : [i]))
      const product = flat.find((p: any) => {
        const t = p?.['@type']
        return t === 'Product' || (Array.isArray(t) && t.includes('Product'))
      })
      if (!product) continue

      title = (product.name || '').trim()
      const img = product.image
      imageUrl = Array.isArray(img) ? img[0] : typeof img === 'object' ? img?.url || '' : img || ''

      if (product.offers) {
        const off = Array.isArray(product.offers) ? product.offers[0] : product.offers
        salePrice = parsePrice(off?.price ?? off?.lowPrice ?? 0)
        originalPrice = parsePrice(off?.highPrice ?? 0) || salePrice
      }
      if (product.aggregateRating?.ratingValue) {
        rating = parseFloat(product.aggregateRating.ratingValue) || undefined
      }
      if (title && salePrice > 0) break
    } catch {}
  }

  // 2) og: meta como complemento/fallback
  const meta = (prop: string): string => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i')
    const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
    return html.match(re)?.[1] || html.match(alt)?.[1] || ''
  }

  if (!title) title = meta('og:title').trim()
  if (!imageUrl) imageUrl = meta('og:image')
  if (!salePrice) {
    salePrice = parsePrice(meta('product:price:amount') || meta('og:price:amount'))
  }

  if (!title || salePrice <= 0) return null

  // 3) Preço promocional exibido na página (tema Shopify da Stanley: <span data-price>R$ 159,50</span>
  //    <span data-compare-at>R$ 319,00</span>). Desconto automático da loja não aparece no
  //    JSON-LD/og:price nem no /products/x.js — em 25/11/2026 o copo de R$159,50 saiu a R$319.
  const shown = html.match(/<[^>]+\sdata-price(?:=["'][^"']*["'])?[^>]*>(?:\s*<span[^>]*>[^<]*<\/span>)?\s*(R\$\s*[\d.,]+)/i)?.[1]
  const compare = html.match(/<[^>]+\sdata-compare-at(?:=["'][^"']*["'])?[^>]*>(?:\s*<span[^>]*>[^<]*<\/span>)?\s*(R\$\s*[\d.,]+)/i)?.[1]
  const shownPrice = parsePrice(shown || '')
  if (shownPrice > 0 && shownPrice < salePrice && shownPrice >= salePrice * 0.2) {
    originalPrice = Math.max(parsePrice(compare || '') || salePrice, salePrice)
    salePrice = shownPrice
  }
  if (originalPrice < salePrice) originalPrice = salePrice

  // og:title vem com entidades HTML (&#34;) e sufixo da loja ("… - AliExpress 7")
  title = title
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s*[-|–]\s*AliExpress(\s*\d+)?\s*$/i, '')
    .trim()

  return { title, salePrice, originalPrice, imageUrl: imageUrl || undefined, rating }
}

export async function fetchGenericProduct(url: string): Promise<GenericProductData | null> {
  // Caminho 1: fetch HTTP direto (rápido, sem browser)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (res.ok) {
      const html = await res.text()
      const data = extractFromHtml(html)
      if (data) {
        console.log(`[GenericProduct] Fetch HTTP OK: "${data.title}" R$${data.salePrice}`)
        return data
      }
    } else {
      console.warn(`[GenericProduct] Fetch HTTP ${res.status} em ${url}`)
    }
  } catch (e) {
    console.warn('[GenericProduct] Fetch HTTP falhou:', (e as Error).message)
  }

  // Caminho 2: Playwright (páginas que só renderizam via JS)
  console.log('[GenericProduct] Tentando Playwright...')
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, locale: 'pt-BR' })
    await context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: function() { return false } })')
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(4000)
    const html = await page.content()
    const data = extractFromHtml(html)
    if (data) {
      console.log(`[GenericProduct] Playwright OK: "${data.title}" R$${data.salePrice}`)
    } else {
      console.warn('[GenericProduct] Playwright não encontrou dados de produto')
    }
    return data
  } catch (e) {
    console.warn('[GenericProduct] Playwright falhou:', (e as Error).message)
    return null
  } finally {
    await browser.close()
  }
}
