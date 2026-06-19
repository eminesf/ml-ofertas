import { BrowserContext } from 'playwright'
import { RawOffer } from '../base.provider'
import { getAuthenticatedContext } from './auth'

const MAX_PRODUCTS = parseInt(process.env.ML_HUB_MAX_PRODUCTS || '50', 10)

const HUB_SCRIPT = `
(function() {
  var cards = document.querySelectorAll('.poly-card, [class*="product-card"], [class*="hub-item"], [class*="offer-item"], article');
  var results = [];
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var linkEl = card.querySelector('a[href*="mercadolivre"], a[href*="mercadopago"]');
    var titleEl = card.querySelector('[class*="title"], [class*="name"]');
    var title = (titleEl ? (titleEl.textContent||'') : (linkEl ? (linkEl.textContent||'') : '')).trim();
    var productUrl = linkEl ? linkEl.href : '';
    if (!title || !productUrl) continue;

    function parseBRL(text) {
      var m = text.replace(/R\\$\\s*/,'').match(/([\\d.]+),?(\\d{2})?/);
      if (!m) return 0;
      return parseFloat(m[0].replace(/\\./g,'').replace(',','.')) || 0;
    }

    var origEl = card.querySelector('s.andes-money-amount--previous, .andes-money-amount--previous');
    var originalPrice = origEl ? parseBRL(origEl.textContent) : 0;

    var saleEl = card.querySelector('.poly-price__current .andes-money-amount--cents-superscript, .poly-component__price .andes-money-amount--cents-superscript');
    var salePrice = saleEl ? parseBRL(saleEl.textContent) : 0;

    var discEl = card.querySelector('.andes-money-amount__discount, .poly-price__disc_label');
    var discText = discEl ? discEl.textContent : '';
    var dm = discText.match(/(\\d+)%/);
    var discountPct = dm ? parseInt(dm[1]) : (originalPrice > 0 && salePrice > 0 ? Math.round((1 - salePrice/originalPrice)*100) : 0);

    var imageEl = card.querySelector('img');
    var imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src || '') : '';

    var ratingEl = card.querySelector('[class*="rating"], [class*="review"]');
    var rating = ratingEl ? parseFloat(ratingEl.textContent||'0') : null;

    var idMatch = productUrl.match(/MLB-?(\\d+)/);
    var externalId = idMatch ? 'MLB' + idMatch[1] : productUrl.split('/').slice(-2).join('_');

    results.push({ title: title, productUrl: productUrl, imageUrl: imageUrl, originalPrice: originalPrice, salePrice: salePrice, discountPct: discountPct, rating: rating, externalId: externalId });
  }
  return results;
})()
`

export async function scrapeHubProducts(
  contextOrNull?: BrowserContext,
  affiliateIdFn?: (url: string) => string
): Promise<RawOffer[]> {
  const ctx = contextOrNull ?? await getAuthenticatedContext()
  const page = await ctx.newPage()
  const offers: RawOffer[] = []

  try {
    await page.goto('https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Clica em "Mais vendidos" se ainda não estiver selecionado
    try {
      const btn = page.locator('#best_seller')
      const isSelected = await btn.getAttribute('aria-pressed')
      if (isSelected !== 'true') {
        await btn.click()
        // Aguarda os produtos do filtro carregarem completamente
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      console.log('[HubScraper] Filtro "Mais vendidos" ativo')
    } catch {
      console.log('[HubScraper] Botão "Mais vendidos" não encontrado, continuando sem filtro')
    }

    // Hub usa virtual scrolling — coleta incrementalmente a cada scroll para não perder cards
    const seen = new Map<string, RawOffer>()
    let noNewRounds = 0

    while (noNewRounds < 4 && seen.size < MAX_PRODUCTS) {
      const items = await page.evaluate(HUB_SCRIPT) as Array<{
        title: string; productUrl: string; imageUrl: string
        originalPrice: number; salePrice: number; discountPct: number
        rating: number | null; externalId: string
      }>

      let newThisRound = 0
      for (const item of items) {
        if (!item.title || !item.productUrl) continue
        const cleanUrl = item.productUrl.split('?')[0]
        if (!cleanUrl.includes('mercadolivre') && !cleanUrl.includes('mercadopago')) continue
        const key = item.externalId || cleanUrl
        if (!seen.has(key)) {
          seen.set(key, {
            externalId: key,
            title: item.title,
            originalPrice: item.originalPrice || item.salePrice,
            salePrice: item.salePrice,
            discountPct: item.discountPct,
            imageUrl: item.imageUrl || undefined,
            productUrl: cleanUrl,
            rating: item.rating ?? undefined,
          })
          newThisRound++
        }
      }

      console.log(`[HubScraper] Scroll ${seen.size} produtos únicos (+${newThisRound} novos)`)
      if (newThisRound === 0) {
        noNewRounds++
      } else {
        noNewRounds = 0
      }

      if (seen.size >= MAX_PRODUCTS) break
      await page.evaluate('window.scrollBy(0, 800)')
      await page.waitForTimeout(1500)
    }

    offers.push(...seen.values())
    console.log(`[HubScraper] ${offers.length} produtos coletados do hub`)
  } catch (error) {
    console.error('[HubScraper] Erro:', error)
  } finally {
    await page.close()
  }

  return offers
}
