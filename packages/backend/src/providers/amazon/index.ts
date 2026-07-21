import { chromium } from 'playwright'
import { AffiliateProvider, RawOffer } from '../base.provider'

// Tag de associado do painel associados.amazon.com.br
const DEFAULT_TAG = 'foxofertas04-20'

export function extractAsin(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i) || url.match(/[?&]asin=([A-Z0-9]{10})/i)
  return m ? m[1].toUpperCase() : null
}

export class AmazonProvider implements AffiliateProvider {
  name = 'amazon'
  private tag: string

  constructor() {
    this.tag = process.env.AMAZON_ASSOCIATE_TAG || DEFAULT_TAG
  }

  buildAffiliateLink(productUrl: string): string {
    try {
      const url = new URL(productUrl)
      // URL canônica curta quando temos o ASIN — evita carregar params de rastreamento
      const asin = extractAsin(productUrl)
      if (asin) {
        return `https://www.amazon.com.br/dp/${asin}?tag=${this.tag}`
      }
      url.searchParams.set('tag', this.tag)
      return url.toString()
    } catch {
      return productUrl
    }
  }

  // Scrape das Ofertas do Dia (https://www.amazon.com.br/deals).
  // Roda apenas LOCAL (IP residencial) — em datacenter a Amazon serve robot-check.
  async scrapeOffers(): Promise<RawOffer[]> {
    console.log('[Amazon] Iniciando scraping de ofertas do dia...')
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
    })
    const offers: RawOffer[] = []

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 900 },
        locale: 'pt-BR',
      })
      await context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: function() { return false } })')
      const page = await context.newPage()

      await page.goto('https://www.amazon.com.br/deals', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(5000)

      if ((await page.title()).toLowerCase().includes('robot')) {
        console.warn('[Amazon] Robot-check detectado — rode localmente com IP residencial')
        return offers
      }

      // Scroll para carregar mais cards (grid com lazy-load)
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 1200)
        await page.waitForTimeout(1200)
      }

      // Extração genérica: âncoras /dp/ASIN dentro de cards do grid de ofertas.
      // String inline (não função nomeada) para evitar bug __name do tsx/esbuild.
      const scriptStr = `
        (function() {
          var seen = {};
          var result = [];
          var anchors = document.querySelectorAll('a[href*="/dp/"]');
          for (var i = 0; i < anchors.length; i++) {
            var a = anchors[i];
            var m = a.href.match(/\\/dp\\/([A-Z0-9]{10})/);
            if (!m) continue;
            var asin = m[1];
            if (seen[asin]) continue;

            // sobe até um container de card razoável
            var card = a.closest('[data-testid], [class*="DealCard"], [class*="dealCard"], li, div[class*="GridItem"]') || a.parentElement;
            if (!card) continue;
            var text = card.textContent || '';

            // precisa ter preço no card
            var priceM = text.match(/R\\$\\s?([\\d.]+,\\d{2})/);
            if (!priceM) continue;
            var salePrice = parseFloat(priceM[1].replace(/\\./g, '').replace(',', '.'));

            // desconto "-23%" ou "23% off"
            var discM = text.match(/(\\d{1,2})\\s?%/);
            var discountPct = discM ? parseInt(discM[1]) : 0;

            // título: procura o melhor candidato de texto no card —
            // elementos com class de título/truncate primeiro, senão o maior
            // trecho de texto que não seja preço/desconto/contador
            var img = card.querySelector('img');
            var title = '';
            if (img && img.alt && img.alt.length > 15) title = img.alt;
            if (!title) {
              var candidates = card.querySelectorAll('[class*="truncate"], [class*="title"], [data-testid*="title"], p, span');
              var best = '';
              for (var c = 0; c < candidates.length; c++) {
                var t = (candidates[c].textContent || '').trim();
                if (t.length < 15 || t.length > 300) continue;
                if (/R\\$|%\\s?off|Termina em|Menor pre|Oferta|^De:/i.test(t)) continue;
                if (t.length > best.length) best = t;
              }
              title = best;
            }
            title = title.replace(/^Oferta\\s*:?\\s*/i, '').trim();
            // remove duplicação "TítuloTítulo" (texto repetido em elementos aninhados)
            for (var half = Math.floor(title.length / 2); half > 20; half--) {
              if (title.slice(0, half) === title.slice(half, half * 2)) {
                title = title.slice(0, half) + title.slice(half * 2);
                break;
              }
            }
            if (!title || title.length < 10) continue;

            var imageUrl = img ? (img.src || '') : '';

            seen[asin] = true;
            result.push({ asin: asin, title: title, salePrice: salePrice, discountPct: discountPct, imageUrl: imageUrl });
          }
          return result;
        })()
      `
      const items = (await page.evaluate(scriptStr)) as Array<{
        asin: string; title: string; salePrice: number; discountPct: number; imageUrl: string
      }>

      for (const item of items) {
        if (!item.salePrice || item.salePrice <= 0) continue
        const originalPrice = item.discountPct > 0
          ? Math.round((item.salePrice / (1 - item.discountPct / 100)) * 100) / 100
          : item.salePrice
        offers.push({
          externalId: `AMZN-${item.asin}`,
          title: item.title.slice(0, 250),
          originalPrice,
          salePrice: item.salePrice,
          discountPct: item.discountPct,
          imageUrl: item.imageUrl || undefined,
          productUrl: `https://www.amazon.com.br/dp/${item.asin}`,
        })
      }

      console.log(`[Amazon] ${offers.length} ofertas coletadas`)
    } catch (err) {
      console.error('[Amazon] Erro no scraping:', err)
    } finally {
      await browser.close()
    }

    return offers
  }
}
