import { chromium } from 'playwright'
import { RawOffer } from '../base.provider'

// PRODUCT_SCRIPT mantido para fallback Playwright
const PRODUCT_SCRIPT = `
(function() {
  function parseBRL(text) {
    if (!text) return 0
    var m = text.replace(/R\\$\\s*/, '').replace(/\\./g, '').replace(',', '.').match(/[\\d]+(?:\\.\\d+)?/)
    return m ? parseFloat(m[0]) : 0
  }

  var jsonLd = null
  var scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (var i = 0; i < scripts.length; i++) {
    try {
      var parsed = JSON.parse(scripts[i].textContent || '')
      var items = Array.isArray(parsed) ? parsed : [parsed]
      var found = items.find(function(p) { return p && p['@type'] === 'Product' })
      if (found) { jsonLd = found; break }
    } catch(e) {}
  }

  var title = (jsonLd && jsonLd.name) ? jsonLd.name.trim() : ''
  if (!title) {
    var h1 = document.querySelector('h1.ui-pdp-title, h1[class*="title"], h1')
    title = h1 ? h1.textContent.trim() : ''
  }

  var image = ''
  if (jsonLd && jsonLd.image) {
    image = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image
  }
  if (!image) {
    var imgEl = document.querySelector(
      'figure.ui-pdp-gallery__figure img, .ui-pdp-image, .figure-zoom img, [class*="gallery"] img'
    )
    image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : ''
    if (image && image.length < 20) image = ''
  }

  var salePrice = 0
  if (jsonLd && jsonLd.offers) {
    var off = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
    salePrice = parseFloat(off.price || off.lowPrice || 0) || 0
  }
  if (!salePrice) {
    var priceSelectors = [
      '.ui-pdp-price__main-container .andes-money-amount__fraction',
      '.andes-money-amount--cents-superscript .andes-money-amount__fraction',
      '.price-tag-fraction',
      '[class*="price__main"] .andes-money-amount__fraction',
    ]
    for (var pi = 0; pi < priceSelectors.length; pi++) {
      var fracEl = document.querySelector(priceSelectors[pi])
      if (fracEl) {
        var amountEl = fracEl.closest('.andes-money-amount')
        var centsEl = amountEl ? amountEl.querySelector('.andes-money-amount__cents, .price-tag-cents') : null
        var ft = fracEl.textContent.replace(/\\./g, '')
        var ct = centsEl ? centsEl.textContent : ''
        salePrice = parseFloat(ct ? ft + '.' + ct : ft) || 0
        if (salePrice > 0) break
      }
    }
  }

  var originalPrice = salePrice
  var origSelectors = [
    's.andes-money-amount',
    '.andes-money-amount--previous',
    '[class*="price-original"] .andes-money-amount',
    '.ui-pdp-price__original-value .andes-money-amount',
  ]
  for (var oi = 0; oi < origSelectors.length; oi++) {
    var origEl = document.querySelector(origSelectors[oi])
    if (origEl) {
      var origF = origEl.querySelector('.andes-money-amount__fraction, .price-tag-fraction')
      var origC = origEl.querySelector('.andes-money-amount__cents, .price-tag-cents')
      if (origF) {
        var oFt = origF.textContent.replace(/\\./g, '')
        var oCt = origC ? origC.textContent : ''
        var op = parseFloat(oCt ? oFt + '.' + oCt : oFt) || 0
        if (op > salePrice) { originalPrice = op; break }
      }
    }
  }

  var discountPct = 0
  var discSelectors = [
    '[class*="price__discount"]',
    '.andes-money-amount__discount',
    '.poly-price__disc_label',
    '[class*="discount-label"]',
    '[class*="discount"]',
  ]
  for (var di = 0; di < discSelectors.length; di++) {
    var discEl = document.querySelector(discSelectors[di])
    if (discEl) {
      var dm = discEl.textContent.match(/(\\d+)%/)
      if (dm) { discountPct = parseInt(dm[1]); break }
    }
  }
  if (!discountPct && originalPrice > salePrice) {
    discountPct = Math.round((1 - salePrice / originalPrice) * 100)
  }

  var rating = null
  if (jsonLd && jsonLd.aggregateRating) {
    rating = parseFloat(jsonLd.aggregateRating.ratingValue || 0) || null
  }
  if (!rating) {
    var ratingSelectors = [
      '.ui-pdp-review__rating',
      '[class*="rating-number"]',
      '[class*="review__rating"]',
      '[class*="reviews-rating"]',
    ]
    for (var ri = 0; ri < ratingSelectors.length; ri++) {
      var ratingEl = document.querySelector(ratingSelectors[ri])
      if (ratingEl) { rating = parseFloat(ratingEl.textContent) || null; if (rating) break }
    }
  }

  return { title: title, image: image, salePrice: salePrice, originalPrice: originalPrice, discountPct: discountPct, rating: rating }
})()
`

async function mlApiGet(path: string): Promise<any> {
  const res = await fetch(`https://api.mercadolibre.com${path}`, {
    headers: { Accept: 'application/json', 'Accept-Language': 'pt-BR' },
  })
  if (!res.ok) throw new Error(`ML API ${res.status}: ${path}`)
  return res.json()
}

function itemToRawOffer(item: any, externalId: string, cleanUrl: string): RawOffer | null {
  const title = item.title?.trim()
  const salePrice = Number(item.price) || 0
  if (!title || !salePrice) return null

  const originalPrice = Number(item.original_price) || salePrice
  const discountPct =
    originalPrice > salePrice ? Math.round((1 - salePrice / originalPrice) * 100) : 0

  // pictures[0].url tem resolução maior que thumbnail
  const image: string = item.pictures?.[0]?.url || item.thumbnail || ''

  return {
    externalId,
    title,
    originalPrice,
    salePrice,
    discountPct,
    imageUrl: image || undefined,
    productUrl: cleanUrl,
    rating: undefined,
  }
}

async function fetchProductFromHtml(
  navUrl: string,
  externalId: string,
  cleanUrl: string,
): Promise<RawOffer | null> {
  console.log(`[ScrapeProduct] Tentando fetch HTTP: ${navUrl}`)
  try {
    const response = await fetch(navUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      console.warn(`[ScrapeProduct] Fetch HTTP retornou ${response.status}`)
      return null
    }

    const html = await response.text()

    if (html.includes('Por segurança') || html.toLowerCase().includes('captcha')) {
      console.warn('[ScrapeProduct] Fetch HTTP recebeu CAPTCHA')
      return null
    }

    let title = ''
    let image = ''
    let salePrice = 0
    let originalPrice = 0
    let rating: number | null = null

    const scriptTags = [
      ...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
    ]
    for (const match of scriptTags) {
      try {
        const data = JSON.parse(match[1].trim())
        const items: any[] = Array.isArray(data) ? data : [data]
        const product = items.find((p: any) => p?.['@type'] === 'Product')
        if (!product) continue

        title = product.name?.trim() || ''
        const img = product.image
        image = Array.isArray(img) ? img[0] : img || ''

        if (product.offers) {
          const off = Array.isArray(product.offers) ? product.offers[0] : product.offers
          salePrice = parseFloat(off.price || off.lowPrice || 0) || 0
          originalPrice = parseFloat(off.highPrice || off.price || 0) || salePrice
        }

        if (product.aggregateRating?.ratingValue) {
          rating = parseFloat(product.aggregateRating.ratingValue) || null
        }

        if (title && salePrice > 0) break
      } catch {}
    }

    if (!title || salePrice <= 0) {
      console.warn('[ScrapeProduct] Fetch HTTP: JSON-LD sem dados suficientes')
      return null
    }

    if (originalPrice < salePrice) originalPrice = salePrice
    const discountPct =
      originalPrice > salePrice ? Math.round((1 - salePrice / originalPrice) * 100) : 0

    console.log(`[ScrapeProduct] Fetch HTTP OK: "${title}" R$${salePrice}`)
    return {
      externalId,
      title,
      originalPrice,
      salePrice,
      discountPct,
      imageUrl: image || undefined,
      productUrl: cleanUrl,
      rating: rating || undefined,
    }
  } catch (e) {
    console.warn('[ScrapeProduct] Fetch HTTP falhou:', (e as Error).message)
    return null
  }
}

async function scrapeWithPlaywright(
  navUrl: string,
  externalId: string,
  cleanUrl: string,
): Promise<RawOffer | null> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
  })
  await context.addInitScript(
    'Object.defineProperty(navigator, "webdriver", { get: function() { return false } })',
  )
  const page = await context.newPage()

  try {
    console.log(`[ScrapeProduct] Playwright navegando para: ${navUrl}`)
    await page.goto(navUrl, { waitUntil: 'networkidle', timeout: 60000 })

    await page
      .waitForSelector(
        'h1, .ui-pdp-title, [class*="title"], .andes-money-amount__fraction, .price-tag-fraction',
        { timeout: 15000 },
      )
      .catch(() => {})

    await page.waitForTimeout(1000)

    const data = (await page.evaluate(PRODUCT_SCRIPT)) as {
      title: string
      image: string
      salePrice: number
      originalPrice: number
      discountPct: number
      rating: number | null
    }

    console.log(`[ScrapeProduct] Playwright extraído: título="${data.title}" preço=${data.salePrice}`)

    if (!data.title || !data.salePrice) {
      console.error('[ScrapeProduct] Dados insuficientes:', data)
      return null
    }

    return {
      externalId,
      title: data.title,
      originalPrice: data.originalPrice || data.salePrice,
      salePrice: data.salePrice,
      discountPct: data.discountPct,
      imageUrl: data.image || undefined,
      productUrl: cleanUrl,
      rating: data.rating || undefined,
    }
  } finally {
    await browser.close()
  }
}

export async function scrapeProductByUrl(url: string): Promise<RawOffer | null> {
  const urlWithoutFragment = url.split('#')[0]
  const navUrl = urlWithoutFragment.split('?')[0]

  // wid = item específico (variação); pode vir em query OU em fragmento
  const widMatch = url.match(/[?&#]wid=(MLB\d+)/)

  const idMatch = url.match(/MLB-?(\d+)/)
  if (!idMatch) {
    console.error('[ScrapeProduct] ID MLB não encontrado na URL:', url)
    return null
  }
  const externalId = `MLB${idMatch[1]}`

  let cleanUrl: string
  if (widMatch) {
    const itemId = widMatch[1].replace('MLB', 'MLB-')
    cleanUrl = `https://produto.mercadolivre.com.br/${itemId}`
  } else {
    cleanUrl = navUrl
  }

  // --- Caminho 1: API ML (sem CAPTCHA, sem browser) ---
  console.log(`[ScrapeProduct] Consultando API ML para: ${externalId}`)
  try {
    let item: any

    if (widMatch) {
      // Tem ID de item específico (wid) — tenta direto; se 403, cai na busca de catálogo
      try {
        item = await mlApiGet(`/items/${widMatch[1]}`)
      } catch (widErr) {
        console.warn(`[ScrapeProduct] wid ${widMatch[1]} falhou (${(widErr as Error).message}), tentando catálogo`)
        const search = await mlApiGet(
          `/sites/MLB/search?catalog_product_id=${externalId}&limit=1`,
        )
        const bestId: string | undefined = search.results?.[0]?.id
        if (bestId) item = await mlApiGet(`/items/${bestId}`)
      }
    } else {
      // Produto de catálogo (/p/MLB...) — busca melhor item disponível
      const search = await mlApiGet(
        `/sites/MLB/search?catalog_product_id=${externalId}&limit=1`,
      )
      const bestId: string | undefined = search.results?.[0]?.id
      if (bestId) {
        item = await mlApiGet(`/items/${bestId}`)
      }
    }

    if (item) {
      const offer = itemToRawOffer(item, externalId, cleanUrl)
      if (offer) {
        console.log(`[ScrapeProduct] API OK: "${offer.title}" R$${offer.salePrice}`)
        return offer
      }
    }
  } catch (e) {
    console.warn('[ScrapeProduct] API ML falhou:', (e as Error).message)
  }

  // --- Caminho 2: HTTP fetch + JSON-LD (sem browser, sem CAPTCHA de JS) ---
  const httpResult = await fetchProductFromHtml(navUrl, externalId, cleanUrl)
  if (httpResult) return httpResult

  // --- Caminho 3: Playwright (último recurso — pode receber CAPTCHA em prod) ---
  console.warn('[ScrapeProduct] Tentando Playwright como último recurso')
  return scrapeWithPlaywright(navUrl, externalId, cleanUrl)
}
