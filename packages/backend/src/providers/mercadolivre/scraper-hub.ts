import { BrowserContext, Locator, Page } from 'playwright'
import { RawOffer } from '../base.provider'
import { getAuthenticatedContext } from './auth'

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

// Abas do hub coletadas (um pouco de cada, não o hub inteiro):
//   "Mais vendidos"  → HUB_BEST_SELLER_MAX (20)
//   "Ganhos extras"  → HUB_EXTRA_MAX (10) — comissão extra para o afiliado
const TABS: Array<{ label: string; locate: (page: Page) => Locator; max: number }> = [
  { label: 'Mais vendidos', locate: page => page.locator('#best_seller'), max: parseInt(process.env.HUB_BEST_SELLER_MAX || '20', 10) },
  {
    label: 'Ganhos extras',
    locate: page => page.locator('button, [role="tab"], [role="button"], a, label').filter({ hasText: /ganhos?\s+extras?/i }).first(),
    max: parseInt(process.env.HUB_EXTRA_MAX || '10', 10),
  },
]

type HubItem = {
  title: string; productUrl: string; imageUrl: string
  originalPrice: number; salePrice: number; discountPct: number
  rating: number | null; externalId: string
}

// Hub usa virtual scrolling — coleta incrementalmente a cada scroll para não perder cards
async function collectVisible(page: Page, max: number, label: string): Promise<RawOffer[]> {
  const seen = new Map<string, RawOffer>()
  let noNewRounds = 0
  while (noNewRounds < 4 && seen.size < max) {
    const items = (await page.evaluate(HUB_SCRIPT)) as HubItem[]
    let newThisRound = 0
    for (const item of items) {
      if (!item.title || !item.productUrl) continue
      const cleanUrl = item.productUrl.split('?')[0]
      if (!cleanUrl.includes('mercadolivre') && !cleanUrl.includes('mercadopago')) continue
      const key = item.externalId || cleanUrl
      if (seen.has(key) || seen.size >= max) continue
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
    console.log(`[HubScraper][${label}] ${seen.size}/${max} produtos (+${newThisRound})`)
    noNewRounds = newThisRound === 0 ? noNewRounds + 1 : 0
    if (seen.size >= max) break
    await page.evaluate('window.scrollBy(0, 800)')
    await page.waitForTimeout(1500)
  }
  return [...seen.values()]
}

export async function scrapeHubProducts(
  contextOrNull?: BrowserContext,
  affiliateIdFn?: (url: string) => string
): Promise<RawOffer[]> {
  const ctx = contextOrNull ?? await getAuthenticatedContext()
  const page = await ctx.newPage()
  const all = new Map<string, RawOffer>()

  try {
    for (const tab of TABS) {
      if (tab.max <= 0) continue
      await page.goto('https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true', { waitUntil: 'networkidle', timeout: 60000 })
      try {
        const btn = tab.locate(page)
        await btn.waitFor({ state: 'visible', timeout: 10000 })
        if ((await btn.getAttribute('aria-pressed')) !== 'true') {
          await btn.click()
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
          await page.waitForTimeout(2000)
        }
        console.log(`[HubScraper] Aba "${tab.label}" ativa`)
      } catch {
        console.log(`[HubScraper] Aba "${tab.label}" não encontrada — pulando`)
        continue
      }
      for (const o of await collectVisible(page, tab.max, tab.label)) if (!all.has(o.externalId)) all.set(o.externalId, o)
    }
    console.log(`[HubScraper] ${all.size} produtos coletados do hub`)
  } catch (error) {
    console.error('[HubScraper] Erro:', error)
  } finally {
    await page.close()
  }

  return [...all.values()]
}
