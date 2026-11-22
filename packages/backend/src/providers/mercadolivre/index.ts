import { newMlContext, saveMlSession, isMlBlockedUrl, reportMlBlocked } from './browser'
import { AffiliateProvider, RawOffer } from '../base.provider'

export class MercadoLivreProvider implements AffiliateProvider {
  name = 'mercadolivre'
  private mattTool: string
  private mattWord: string

  constructor() {
    this.mattTool = process.env.ML_AFFILIATE_ID || ''
    this.mattWord = process.env.ML_AFFILIATE_WORD || ''
  }

  buildAffiliateLink(productUrl: string): string {
    try {
      const url = new URL(productUrl)
      url.searchParams.set('matt_tool', this.mattTool)
      url.searchParams.set('matt_word', this.mattWord)
      return url.toString()
    } catch {
      return productUrl
    }
  }

  // Usa a sessão salva do ML (resolva captcha/login com `npm run ml:login`)
  private async createBrowser() {
    return newMlContext()
  }

  async scrapeOffers(): Promise<RawOffer[]> {
    console.log('[ML] Iniciando scraping de ofertas...')
    const { browser, context } = await this.createBrowser()
    const page = await context.newPage()
    const offers: RawOffer[] = []

    try {
      await page.goto('https://www.mercadolivre.com.br/ofertas', {
        waitUntil: 'networkidle',
        timeout: 60000
      })

      if (isMlBlockedUrl(page.url())) {
        await reportMlBlocked('scrape de /ofertas')
        return offers
      }

      await page.waitForSelector('.poly-card', { timeout: 30000 })
      await page.waitForTimeout(2000)

      // Extrai dados via evaluate — sem funções nomeadas para evitar __name do tsx/esbuild
      const scriptStr = `
        (function() {
          var cards = document.querySelectorAll('.poly-card');
          var result = [];
          for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var origEl = card.querySelector('s.andes-money-amount--previous');
            var origF = origEl ? (origEl.querySelector('.andes-money-amount__fraction') || {textContent:'0'}).textContent.replace(/\\./g,'') : '0';
            var origC = origEl ? ((origEl.querySelector('.andes-money-amount__cents') || {textContent:''}).textContent) : '';
            var originalPrice = parseFloat(origC ? origF + '.' + origC : origF) || 0;

            var saleEl = card.querySelector('.poly-price__current .andes-money-amount--cents-superscript');
            var saleF = saleEl ? (saleEl.querySelector('.andes-money-amount__fraction') || {textContent:'0'}).textContent.replace(/\\./g,'') : '0';
            var saleC = saleEl ? ((saleEl.querySelector('.andes-money-amount__cents') || {textContent:''}).textContent) : '';
            var salePrice = parseFloat(saleC ? saleF + '.' + saleC : saleF) || 0;

            var discountText = (card.querySelector('.poly-price__disc_label') || {textContent:''}).textContent;
            var dm = discountText.match(/(\\d+)%/);
            var discountPct = dm ? parseInt(dm[1]) : (originalPrice > 0 ? Math.round((1 - salePrice / originalPrice) * 100) : 0);

            var linkEl = card.querySelector('a.poly-component__title');
            var title = linkEl ? (linkEl.textContent || '').trim() : '';
            var productUrl = linkEl ? linkEl.href : '';

            var imageEl = card.querySelector('.poly-component__picture');
            var imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src || '') : '';

            var ratingText = (card.querySelector('.poly-reviews__rating') || {textContent:''}).textContent;
            var rating = ratingText ? parseFloat(ratingText) : null;

            var couponText = (card.querySelector('.poly-coupons__pill') || {textContent:''}).textContent.trim();
            var cm = couponText.match(/R\\$\\s*(\\d+)/);
            var couponAmount = cm ? 'R$' + cm[1] + ' OFF' : '';

            var idMatch = productUrl.match(/MLB-?(\\d+)/);
            var externalId = idMatch ? 'MLB' + idMatch[1] : '';

            result.push({ title: title, productUrl: productUrl, originalPrice: originalPrice, salePrice: salePrice, discountPct: discountPct, imageUrl: imageUrl, rating: rating, externalId: externalId, couponAmount: couponAmount });
          }
          return result;
        })()
      `
      const items = await page.evaluate(scriptStr) as Array<{
        title: string; productUrl: string; originalPrice: number; salePrice: number
        discountPct: number; imageUrl: string; rating: number | null; externalId: string; couponAmount: string
      }>

      for (const item of items) {
        if (!item.title || !item.productUrl || item.salePrice === 0) continue

        const widMatch = item.productUrl.match(/[?&]wid=(MLB\d+)/)
        let cleanUrl: string
        if (widMatch) {
          const itemId = widMatch[1].replace('MLB', 'MLB-')
          cleanUrl = `https://produto.mercadolivre.com.br/${itemId}`
        } else {
          cleanUrl = item.productUrl.split('?')[0]
        }
        if (!cleanUrl.includes('mercadolivre')) continue

        offers.push({
          externalId: item.externalId || cleanUrl,
          title: item.title,
          originalPrice: item.originalPrice || item.salePrice,
          salePrice: item.salePrice,
          discountPct: item.discountPct,
          imageUrl: item.imageUrl || undefined,
          productUrl: cleanUrl,
          rating: item.rating,
          couponAmount: item.couponAmount || undefined,
        } as any)
      }

      console.log(`[ML] ${offers.length} ofertas coletadas`)
      await saveMlSession(context)
    } catch (error) {
      console.error('[ML] Erro no scraping de ofertas:', error)
    } finally {
      await browser.close()
    }

    return offers
  }

}