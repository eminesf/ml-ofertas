import { chromium } from 'playwright'
import { RawOffer } from '../base.provider'

const PRODUCT_SCRIPT = `
(function() {
  function parseBRL(text) {
    if (!text) return 0
    var m = text.replace(/R\\$\\s*/, '').replace(/\\./g, '').replace(',', '.').match(/[\\d]+(?:\\.\\d+)?/)
    return m ? parseFloat(m[0]) : 0
  }

  // --- JSON-LD (fonte primária) ---
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

  // --- Título ---
  var title = (jsonLd && jsonLd.name) ? jsonLd.name.trim() : ''
  if (!title) {
    var h1 = document.querySelector('h1.ui-pdp-title, h1[class*="title"], h1')
    title = h1 ? h1.textContent.trim() : ''
  }

  // --- Imagem ---
  var image = ''
  if (jsonLd && jsonLd.image) {
    image = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image
  }
  if (!image) {
    var imgEl = document.querySelector(
      'figure.ui-pdp-gallery__figure img, .ui-pdp-image, .figure-zoom img, [class*="gallery"] img'
    )
    image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : ''
    // descarta thumbnails (src muito curta)
    if (image && image.length < 20) image = ''
  }

  // --- Preço atual ---
  var salePrice = 0
  if (jsonLd && jsonLd.offers) {
    var off = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
    salePrice = parseFloat(off.price || off.lowPrice || 0) || 0
  }
  if (!salePrice) {
    // Tenta vários seletores — a estrutura muda entre /p/ e produto.mercadolivre.com.br
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

  // --- Preço original (tachado) ---
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

  // --- Desconto ---
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

  // --- Avaliação ---
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

export async function scrapeProductByUrl(url: string): Promise<RawOffer | null> {
  // Separa base (sem query e sem fragmento) para navegação limpa
  const urlWithoutFragment = url.split('#')[0]
  const navUrl = urlWithoutFragment.split('?')[0]

  // wid pode vir na query OU no fragmento (ML usa # como separador em links de busca)
  const widMatch = url.match(/[?&#]wid=(MLB\d+)/)

  const idMatch = url.match(/MLB-?(\d+)/)
  if (!idMatch) {
    console.error('[ScrapeProduct] ID MLB não encontrado na URL:', url)
    return null
  }
  const externalId = `MLB${idMatch[1]}`

  let cleanUrl: string
  if (widMatch) {
    // Produto com variação — usa URL canônica de item específico
    const itemId = widMatch[1].replace('MLB', 'MLB-')
    cleanUrl = `https://produto.mercadolivre.com.br/${itemId}`
  } else {
    // Multi-vendedor — usa a URL base sem query/fragmento
    cleanUrl = navUrl
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
  })
  await context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: function() { return false } })')
  const page = await context.newPage()

  try {
    console.log(`[ScrapeProduct] Navegando para: ${navUrl}`)
    await page.goto(navUrl, { waitUntil: 'networkidle', timeout: 60000 })

    // Aguarda o título ou preço aparecer (JS renderiza após load)
    await page.waitForSelector(
      'h1, .ui-pdp-title, [class*="title"], .andes-money-amount__fraction, .price-tag-fraction',
      { timeout: 15000 }
    ).catch(() => {}) // não lança — tenta extrair mesmo assim

    await page.waitForTimeout(1000)

    const data = await page.evaluate(PRODUCT_SCRIPT) as {
      title: string; image: string; salePrice: number
      originalPrice: number; discountPct: number; rating: number | null
    }

    console.log(`[ScrapeProduct] Extraído: título="${data.title}" preço=${data.salePrice}`)

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
