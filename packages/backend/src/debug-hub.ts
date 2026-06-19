import './env'
import { getAuthenticatedContext } from './providers/mercadolivre/auth'

async function main() {
  const ctx = await getAuthenticatedContext()
  const page = await ctx.newPage()

  try {
    await page.goto('https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    // Clica em "Mais vendidos"
    try {
      const btn = page.locator('#best_seller')
      const isSelected = await btn.getAttribute('aria-pressed')
      if (isSelected !== 'true') {
        await btn.click()
        await page.waitForTimeout(2000)
      }
    } catch {}

    // Scroll inicial para carregar mais items
    for (let i = 0; i < 3; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
      await page.waitForTimeout(2000)
    }

    // Conta quantos elementos cada seletor encontra
    const counts = await page.evaluate(`
      (function() {
        return {
          'poly-card': document.querySelectorAll('.poly-card').length,
          'article': document.querySelectorAll('article').length,
          'li': document.querySelectorAll('li').length,
          'product-card': document.querySelectorAll('[class*="product-card"]').length,
          'hub-item': document.querySelectorAll('[class*="hub-item"]').length,
          'recommendation': document.querySelectorAll('[class*="recommendation"]').length,
          'shelf': document.querySelectorAll('[class*="shelf"]').length,
          'a[href*=mercadolivre]': document.querySelectorAll('a[href*="mercadolivre"]').length,
        }
      })()
    `)
    console.log('\n=== Contagem de seletores ===')
    console.log(counts)

    // Pega todas as classes únicas que contêm palavras-chave de produto
    const classes = await page.evaluate(`
      (function() {
        return [...new Set(
          [...document.querySelectorAll('*')]
            .flatMap(el => [...el.classList])
            .filter(c => /card|item|product|oferta|poly|shelf|recommend|hub/i.test(c))
        )].slice(0, 40)
      })()
    `)
    console.log('\n=== Classes relevantes na página ===')
    console.log(classes)

    // Mostra o HTML do primeiro elemento que tem um link de produto
    const firstCard = await page.evaluate(`
      (function() {
        var links = document.querySelectorAll('a[href*="mercadolivre.com"]');
        if (!links.length) return 'Nenhum link encontrado';
        var parent = links[0].closest('[class]');
        return parent ? {
          tag: parent.tagName,
          classes: parent.className,
          html: parent.innerHTML.slice(0, 500)
        } : { href: links[0].href, text: links[0].textContent?.trim() };
      })()
    `)
    console.log('\n=== Primeiro card encontrado ===')
    console.log(JSON.stringify(firstCard, null, 2))

    // Roda o HUB_SCRIPT exato e mostra o que retorna
    const hubResult = await page.evaluate(`
      (function() {
        var cards = document.querySelectorAll('.poly-card');
        var out = [];
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var linkEl = card.querySelector('a[href*="mercadolivre"], a[href*="mercadopago"]');
          var titleEl = card.querySelector('[class*="title"], [class*="name"]');
          var title = (titleEl ? (titleEl.textContent||'') : (linkEl ? (linkEl.textContent||'') : '')).trim();
          var productUrl = linkEl ? linkEl.href : '';
          out.push({
            i: i,
            hasLink: !!linkEl,
            hasTitle: !!titleEl,
            title: title.slice(0, 50),
            productUrl: (productUrl||'').slice(0, 80),
            skipped: !title || !productUrl
          });
        }
        return out;
      })()
    `)
    console.log('\n=== HUB_SCRIPT resultado por card ===')
    console.log(JSON.stringify(hubResult, null, 2))
    const skipped = (hubResult as any[]).filter((r: any) => r.skipped)
    console.log(`\nCards com título ou URL vazios (seriam pulados): ${skipped.length}`)
    skipped.forEach((r: any) => console.log(`  card[${r.i}]: hasLink=${r.hasLink}, hasTitle=${r.hasTitle}, title="${r.title}", url="${r.productUrl}"`))

    // Detalha o que tem dentro de cada poly-card
    const cards = await page.evaluate(`
      (function() {
        var cards = document.querySelectorAll('.poly-card');
        var out = [];
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var link = card.querySelector('a[href]');
          var href = link ? link.href : '';
          var titleEl = card.querySelector('[class*="title"], [class*="name"]');
          var title = (titleEl ? titleEl.textContent : (link ? link.textContent : '')).trim().slice(0, 60);
          out.push({ i: i, href: href.slice(0, 100), title: title });
        }
        return out;
      })()
    `)
    console.log('\n=== Detalhes de cada poly-card ===')
    console.log(JSON.stringify(cards, null, 2))

    // Inspeciona elementos de preço dentro do primeiro poly-card
    const priceDebug = await page.evaluate(`
      (function() {
        var card = document.querySelector('.poly-card');
        if (!card) return { error: 'no card' };
        var allEls = card.querySelectorAll('[class*="price"], [class*="amount"], [class*="money"]');
        var info = [];
        for (var i = 0; i < allEls.length; i++) {
          var el = allEls[i];
          info.push({ classes: el.className.slice(0, 100), text: el.textContent.trim().slice(0, 50) });
        }
        return { cardTitle: (card.querySelector('a') || {textContent: ''}).textContent.trim().slice(0, 60), elements: info };
      })()
    `)
    console.log('\n=== Elementos de preço no primeiro poly-card ===')
    console.log(JSON.stringify(priceDebug, null, 2))

    await page.screenshot({ path: 'debug-hub.png', fullPage: false })
    console.log('\nScreenshot salvo: debug-hub.png')

  } finally {
    await ctx.browser()?.close()
  }
}

main().catch(console.error)
