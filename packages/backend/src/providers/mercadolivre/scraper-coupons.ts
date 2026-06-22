import { BrowserContext, Page } from 'playwright'
import { RawOffer } from '../base.provider'
import { getAuthenticatedContext } from './auth'
import { prisma } from '../../utils/prisma'

export interface ScrapedCoupon {
  code: string
  discount: string
  minValue?: number
  category?: string
  expiresAt?: Date
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
  function parseBRL(el) {
    if (!el) return 0;
    var text = (el.textContent || '').replace(/R\\$\\s*/g, '').trim();
    var m = text.match(/([\\d.]+),([\\d]{2})/);
    if (m) return parseFloat(m[1].replace(/\\./g, '') + '.' + m[2]);
    var m2 = text.match(/([\\d.]+)/);
    return m2 ? parseFloat(m2[1].replace(/\\./g, '')) : 0;
  }

  var cards = document.querySelectorAll('.poly-card, [class*="product-card"], article');
  var results = [];
  var limit = Math.min(cards.length, 20);
  for (var i = 0; i < limit; i++) {
    var card = cards[i];
    var linkEl = card.querySelector('a.poly-component__title, a[href*="mercadolivre.com.br"]');
    var titleEl = card.querySelector('a.poly-component__title, [class*="title"]');
    var title = (titleEl ? (titleEl.textContent||'') : (linkEl ? (linkEl.textContent||'') : '')).trim();
    var productUrl = linkEl ? linkEl.href : '';
    if (!title || !productUrl) continue;

    var origEl = card.querySelector('s.andes-money-amount--previous, .andes-money-amount--previous');
    var originalPrice = parseBRL(origEl);

    var saleEl = card.querySelector('.poly-price__current .andes-money-amount--cents-superscript, .poly-price__current');
    var salePrice = parseBRL(saleEl);
    if (!salePrice) salePrice = originalPrice;

    var discEl = card.querySelector('.poly-price__disc_label, [class*="disc_label"]');
    var discText = discEl ? (discEl.textContent||'') : '';
    var dm = discText.match(/(\\d+)%/);
    var discountPct = dm ? parseInt(dm[1]) : (originalPrice > 0 && salePrice > 0 ? Math.round((1-salePrice/originalPrice)*100) : 0);

    var imageEl = card.querySelector('img.poly-component__picture, img');
    var imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src || '') : '';
    var ratingEl = card.querySelector('.poly-reviews__rating, [class*="rating"]');
    var rating = ratingEl ? parseFloat(ratingEl.textContent||'0') : null;
    var idMatch = productUrl.match(/MLB-?(\\d+)/);
    var externalId = idMatch ? 'MLB' + idMatch[1] : productUrl.split('/').slice(-1)[0];

    if (salePrice > 0) {
      results.push({ title: title, productUrl: productUrl, imageUrl: imageUrl, originalPrice: originalPrice, salePrice: salePrice, discountPct: discountPct, rating: rating, externalId: externalId });
    }
  }
  return results;
})()
`

const COUPON_LIST_SCRIPT = `
(function() {
  var items = [];
  var couponEls = document.querySelectorAll('[class*="generated-coupon-item__details"]');
  for (var i = 0; i < couponEls.length; i++) {
    var el = couponEls[i];
    var codeEl = el.querySelector('b');
    var code = codeEl ? (codeEl.textContent||'').trim() : '';
    var discEl = el.querySelector('[class*="inner-details-title"]');
    var discount = discEl ? (discEl.textContent||'').trim() : '';
    var expEl = el.querySelector('[class*="expiration"] span');
    var expiresText = expEl ? (expEl.textContent||'').trim() : '';
    var hasLink = !!el.querySelector('a[class*="generated-coupon-item__link"]');
    if (code) items.push({ code: code, discount: discount, expiresText: expiresText, index: i, hasLink: hasLink });
  }
  return items;
})()
`

async function getCouponMinValue(page: Page, couponIndex: number): Promise<number | undefined> {
  try {
    // Clica em "Condições do cupom" para abrir o modal
    const triggers = await page.locator('[class*="modal-trigger"]').all()
    if (!triggers[couponIndex]) return undefined

    await triggers[couponIndex].click()
    await page.waitForTimeout(1000)

    // Lê o texto do modal
    const modalText = await page.locator('[class*="andes-modal"] [class*="andes-typography--size-m"]')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => '')

    // Fecha o modal (botão X ou ESC)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(500)

    if (!modalText) return undefined

    // Extrai valor mínimo: "igual ou superior a R$ 120"
    const match = modalText.match(/igual ou superior a R\$\s*([\d.]+)/i)
    if (match) {
      const value = parseFloat(match[1].replace(/\./g, ''))
      console.log(`[CouponScraper] Condições do cupom: mínimo R$${value}`)
      return value
    }
  } catch (err) {
    console.log(`[CouponScraper] Não foi possível ler condições do cupom:`, err)
  }
  return undefined
}

async function scrapeProductsFromNewTab(
  ctx: BrowserContext,
  page: Page,
  couponIndex: number
): Promise<{ offers: RawOffer[], minValue?: number }> {
  const offers: RawOffer[] = []
  let newPage: Page | undefined
  let minValue: number | undefined

  try {
    const links = await page.locator('a.generated-coupon-item__link').all()
    if (!links[couponIndex]) {
      console.log(`[CouponScraper] Link não encontrado no índice ${couponIndex}`)
      return { offers }
    }

    const [opened] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 10000 }),
      links[couponIndex].click(),
    ])
    newPage = opened

    await newPage.waitForLoadState('networkidle', { timeout: 30000 })
    await newPage.waitForTimeout(1500)

    console.log(`[CouponScraper] Nova aba aberta: ${newPage.url()}`)

    const items = await newPage.evaluate(PRODUCT_SCRIPT) as Array<{
      title: string; productUrl: string; imageUrl: string
      originalPrice: number; salePrice: number; discountPct: number
      rating: number | null; externalId: string
    }>

    console.log(`[CouponScraper] ${items.length} produtos encontrados na aba`)

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
    console.error(`[CouponScraper] Erro ao raspar produtos da aba:`, err)
  } finally {
    await newPage?.close().catch(() => {})
  }

  return { offers, minValue }
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

    // Tenta clicar na aba "Códigos gerados" se existir
    try {
      const tabBtn = page.locator('button:has-text("Códigos gerados"), a:has-text("Códigos gerados")').first()
      await tabBtn.click({ timeout: 5000 })
      await page.waitForTimeout(2000)
    } catch {
      console.log('[CouponScraper] Aba "Códigos gerados" não encontrada, continuando...')
    }

    const coupons = await page.evaluate(COUPON_LIST_SCRIPT) as Array<{
      code: string; discount: string; expiresText: string; index: number; hasLink: boolean
    }>

    console.log(`[CouponScraper] ${coupons.length} cupons encontrados`)

    for (const c of coupons) {
      console.log(`[CouponScraper] Processando cupom ${c.code} (hasLink: ${c.hasLink})`)
      const expiresAt = parseExpiryDate(c.expiresText)

      let products: RawOffer[] = []
      let minValue: number | undefined

      if (c.hasLink) {
        // Lê condições do cupom (abre modal) antes de navegar para nova aba
        minValue = await getCouponMinValue(page, c.index)

        const result2 = await scrapeProductsFromNewTab(ctx, page, c.index)
        products = result2.offers
      }

      result.push({
        code: c.code,
        discount: c.discount,
        expiresAt,
        minValue,
        category: 'geral',
        products,
      })

      console.log(`[CouponScraper] Cupom ${c.code}: ${products.length} produtos${minValue ? ` | mínimo R$${minValue}` : ''}`)
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
          minValue: c.minValue,
          expiresAt: c.expiresAt,
          active: !isExpired,
          category: c.category || 'geral',
        },
        update: {
          discount: c.discount,
          minValue: c.minValue,
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
