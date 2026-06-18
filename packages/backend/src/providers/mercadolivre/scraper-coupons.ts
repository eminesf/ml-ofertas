import { BrowserContext } from 'playwright'
import { RawOffer, RawCoupon } from '../base.provider'
import { getAuthenticatedContext } from './auth'
import { prisma } from '../../utils/prisma'

export interface ScrapedCoupon extends RawCoupon {
  products: RawOffer[]
}

function parseExpiryDate(text: string): Date | undefined {
  const months: Record<string, number> = {
    janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
    mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  }
  const match = text.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)/)
  if (!match) return undefined
  const day = parseInt(match[1])
  const month = months[match[2]]
  if (month === undefined) return undefined
  const year = new Date().getFullYear()
  const date = new Date(year, month, day)
  if (date < new Date()) date.setFullYear(year + 1)
  return date
}

const PRODUCT_SCRIPT = `
(function() {
  var cards = document.querySelectorAll('.poly-card, [class*="product-card"], article');
  var results = [];
  var limit = Math.min(cards.length, 20);
  for (var i = 0; i < limit; i++) {
    var card = cards[i];
    var linkEl = card.querySelector('a[href*="mercadolivre"]');
    var titleEl = card.querySelector('[class*="title"]');
    var title = (titleEl ? (titleEl.textContent||'') : (linkEl ? (linkEl.textContent||'') : '')).trim();
    var productUrl = linkEl ? linkEl.href : '';
    if (!title || !productUrl) continue;

    var origEl = card.querySelector('s, [class*="previous"]');
    var origF = origEl ? ((origEl.querySelector('.andes-money-amount__fraction')||{textContent:'0'}).textContent.replace(/\./g,'')) : '0';
    var origC = origEl ? ((origEl.querySelector('.andes-money-amount__cents')||{textContent:''}).textContent) : '';
    var originalPrice = parseFloat(origC ? origF+'.'+origC : origF) || 0;

    var saleEl = card.querySelector('[class*="current"]');
    var saleF = saleEl ? ((saleEl.querySelector('.andes-money-amount__fraction')||{textContent:origF}).textContent.replace(/\./g,'')) : origF;
    var saleC = saleEl ? ((saleEl.querySelector('.andes-money-amount__cents')||{textContent:''}).textContent) : '';
    var salePrice = parseFloat(saleC ? saleF+'.'+saleC : saleF) || originalPrice;

    var discEl = card.querySelector('[class*="disc"]');
    var discText = discEl ? discEl.textContent : '';
    var dm = discText.match(/(\\d+)%/);
    var discountPct = dm ? parseInt(dm[1]) : (originalPrice > 0 ? Math.round((1-salePrice/originalPrice)*100) : 0);

    var imageEl = card.querySelector('img');
    var imageUrl = imageEl ? (imageEl.src||'') : '';
    var ratingEl = card.querySelector('[class*="rating"]');
    var rating = ratingEl ? parseFloat(ratingEl.textContent||'0') : null;
    var idMatch = productUrl.match(/MLB\\d+/);
    var externalId = idMatch ? idMatch[0] : productUrl.split('/').slice(-1)[0];

    results.push({ title: title, productUrl: productUrl, imageUrl: imageUrl, originalPrice: originalPrice, salePrice: salePrice, discountPct: discountPct, rating: rating, externalId: externalId });
  }
  return results;
})()
`

const COUPON_LIST_SCRIPT = `
(function() {
  var items = [];
  var couponEls = document.querySelectorAll('[class*="generated-coupon"], [class*="coupon-item"]');
  for (var i = 0; i < couponEls.length; i++) {
    var el = couponEls[i];
    var codeEl = el.querySelector('[class*="code"], code');
    var code = codeEl ? (codeEl.textContent||'').trim() : '';
    var discEl = el.querySelector('[class*="discount"], [class*="valor"]');
    var discount = discEl ? (discEl.textContent||'').trim() : '';
    var expEl = el.querySelector('[class*="secondary"], [class*="expir"], [class*="vence"]');
    var expiresText = expEl ? (expEl.textContent||'').trim() : '';
    var linkEl = el.querySelector('a[class*="link"], a[href*="produtos"], a[href*="products"]');
    var productLink = linkEl ? linkEl.href : '';
    if (code) items.push({ code: code, discount: discount, expiresText: expiresText, productLink: productLink });
  }
  return items;
})()
`

async function scrapeCouponProducts(
  ctx: BrowserContext,
  productPageUrl: string,
  affiliateIdFn?: (url: string) => string
): Promise<RawOffer[]> {
  const page = await ctx.newPage()
  const offers: RawOffer[] = []

  try {
    await page.goto(productPageUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const items = await page.evaluate(PRODUCT_SCRIPT) as Array<{
      title: string; productUrl: string; imageUrl: string
      originalPrice: number; salePrice: number; discountPct: number
      rating: number | null; externalId: string
    }>

    for (const item of items) {
      if (!item.title || !item.productUrl) continue
      const cleanUrl = item.productUrl.split('?')[0]
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
  } catch (err) {
    console.error('[CouponScraper] Erro ao coletar produtos do cupom:', err)
  } finally {
    await page.close()
  }

  return offers
}

export async function scrapeCouponsAndProducts(
  contextOrNull?: BrowserContext,
  affiliateIdFn?: (url: string) => string
): Promise<ScrapedCoupon[]> {
  const ctx = contextOrNull ?? await getAuthenticatedContext()
  const page = await ctx.newPage()
  const result: ScrapedCoupon[] = []

  try {
    await page.goto('https://www.mercadolivre.com.br/afiliados/coupons#hub', {
      waitUntil: 'networkidle',
      timeout: 60000
    })
    await page.waitForTimeout(2000)

    try {
      const tabBtn = page.locator('button:has-text("Códigos gerados"), a:has-text("Códigos gerados")').first()
      await tabBtn.click({ timeout: 5000 })
      await page.waitForTimeout(2000)
    } catch {
      console.log('[CouponScraper] Aba "Códigos gerados" não encontrada, continuando...')
    }

    const coupons = await page.evaluate(COUPON_LIST_SCRIPT) as Array<{
      code: string; discount: string; expiresText: string; productLink: string
    }>

    console.log(`[CouponScraper] ${coupons.length} cupons encontrados`)

    for (const c of coupons) {
      const expiresAt = parseExpiryDate(c.expiresText)
      const products = c.productLink
        ? await scrapeCouponProducts(ctx, c.productLink, affiliateIdFn)
        : []

      result.push({
        code: c.code,
        discount: c.discount,
        expiresAt,
        category: 'geral',
        products,
      })
    }

    await persistCoupons(result)

  } catch (error) {
    console.error('[CouponScraper] Erro:', error)
  } finally {
    await page.close().catch(() => {})
  }

  return result
}

async function persistCoupons(coupons: ScrapedCoupon[]): Promise<void> {
  const now = new Date()

  for (const c of coupons) {
    try {
      const isExpired = c.expiresAt ? c.expiresAt < now : false
      await prisma.coupon.upsert({
        where: { code_provider: { code: c.code, provider: 'mercadolivre' } },
        create: {
          provider: 'mercadolivre',
          code: c.code,
          discount: c.discount,
          expiresAt: c.expiresAt,
          active: !isExpired,
          category: c.category || 'geral',
        },
        update: {
          discount: c.discount,
          expiresAt: c.expiresAt,
          active: !isExpired,
        }
      })
    } catch (err) {
      console.error('[CouponScraper] Erro ao salvar cupom:', c.code, err)
    }
  }

  await prisma.coupon.updateMany({
    where: { expiresAt: { lt: now }, active: true },
    data: { active: false }
  })

  console.log(`[CouponScraper] ${coupons.length} cupons persistidos`)
}
