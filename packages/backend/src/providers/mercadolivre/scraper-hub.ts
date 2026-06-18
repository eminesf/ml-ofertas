import { BrowserContext } from 'playwright'
import { RawOffer } from '../base.provider'
import { getAuthenticatedContext } from './auth'

const CATEGORY_KEYWORDS = [
  'copa', 'fifa', 'panini', 'figurinha', 'álbum', 'album', 'seleção', 'selecao',
  'pokémon', 'pokemon', 'tcg', 'booster', 'pack', 'carta', 'pikachu',
  'camiseta', 'camisa', 'jersey', 'brasil', 'portugal', 'argentina',
  'nike', 'adidas',
  'mais vendido', 'mais vendidos', 'lançamento',
]

function matchesCategory(title: string): boolean {
  const lower = title.toLowerCase()
  return CATEGORY_KEYWORDS.some(kw => lower.includes(kw))
}

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

    var origEl = card.querySelector('s, [class*="previous"], [class*="original"]');
    var origF = origEl ? ((origEl.querySelector('.andes-money-amount__fraction')||{textContent:'0'}).textContent.replace(/\./g,'')) : '0';
    var origC = origEl ? ((origEl.querySelector('.andes-money-amount__cents')||{textContent:''}).textContent) : '';
    var originalPrice = parseFloat(origC ? origF+'.'+origC : origF) || 0;

    var saleEl = card.querySelector('[class*="current"], [class*="price"]:not(s)');
    var saleF = saleEl ? ((saleEl.querySelector('.andes-money-amount__fraction')||{textContent:'0'}).textContent.replace(/\./g,'')) : origF;
    var saleC = saleEl ? ((saleEl.querySelector('.andes-money-amount__cents')||{textContent:''}).textContent) : origC;
    var salePrice = parseFloat(saleC ? saleF+'.'+saleC : saleF) || originalPrice;

    var discEl = card.querySelector('[class*="disc"], [class*="discount"]');
    var discText = discEl ? discEl.textContent : '';
    var dm = discText.match(/(\\d+)%/);
    var discountPct = dm ? parseInt(dm[1]) : (originalPrice > 0 ? Math.round((1 - salePrice/originalPrice)*100) : 0);

    var imageEl = card.querySelector('img');
    var imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src || '') : '';

    var ratingEl = card.querySelector('[class*="rating"], [class*="review"]');
    var rating = ratingEl ? parseFloat(ratingEl.textContent||'0') : null;

    var isBestSeller = !!(card.querySelector('[class*="best-seller"], [class*="mais-vendido"]')) || (card.textContent||'').toLowerCase().includes('mais vendido');

    var idMatch = productUrl.match(/MLB\\d+/);
    var externalId = idMatch ? idMatch[0] : productUrl.split('/').slice(-2).join('_');

    results.push({ title: title, productUrl: productUrl, imageUrl: imageUrl, originalPrice: originalPrice, salePrice: salePrice, discountPct: discountPct, rating: rating, externalId: externalId, isBestSeller: isBestSeller });
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

    for (let i = 0; i < 3; i++) {
      await page.evaluate('window.scrollBy(0, 1500)')
      await page.waitForTimeout(2000)
    }

    const items = await page.evaluate(HUB_SCRIPT) as Array<{
      title: string; productUrl: string; imageUrl: string
      originalPrice: number; salePrice: number; discountPct: number
      rating: number | null; externalId: string; isBestSeller: boolean
    }>

    for (const item of items) {
      if (!item.title || !item.productUrl) continue
      const cleanUrl = item.productUrl.split('?')[0]
      if (!cleanUrl.includes('mercadolivre') && !cleanUrl.includes('mercadopago')) continue

      const passes = matchesCategory(item.title) || item.isBestSeller || item.discountPct > 25
      if (!passes) continue

      offers.push({
        externalId: item.externalId || cleanUrl,
        title: item.title,
        originalPrice: item.originalPrice || item.salePrice,
        salePrice: item.salePrice,
        discountPct: item.discountPct,
        imageUrl: item.imageUrl || undefined,
        productUrl: cleanUrl,
        rating: item.rating ?? undefined,
      })
    }

    console.log(`[HubScraper] ${offers.length} produtos coletados do hub`)
  } catch (error) {
    console.error('[HubScraper] Erro:', error)
  } finally {
    await page.close()
  }

  return offers
}
