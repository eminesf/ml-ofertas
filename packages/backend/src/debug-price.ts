import './env'
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  const page = await context.newPage()

  await page.goto('https://www.mercadolivre.com.br/ofertas', {
    waitUntil: 'networkidle',
    timeout: 60000
  })

  await page.waitForSelector('.poly-card', { timeout: 30000 })
  await page.waitForTimeout(2000)

  // Pega o HTML completo do primeiro card pra ver estrutura de preÃ§o
  const firstCardHtml = await page.$eval('.poly-card', el => el.innerHTML)
  console.log('=== HTML do primeiro card ===')
  console.log(firstCardHtml)
  console.log('\n')

  // Testa seletores de preÃ§o especÃ­ficos
  const priceDebug = await page.$$eval('.poly-card', cards => {
    return cards.slice(0, 5).map(card => {
      // Pega todos os elementos de preÃ§o dentro do card
      const priceEls = card.querySelectorAll('[class*="price"], [class*="amount"], del, s, [class*="original"]')
      const priceData = [...priceEls].map(el => ({
        tag: el.tagName,
        class: [...el.classList].join(' '),
        text: el.textContent?.trim().slice(0, 50)
      }))

      const title = card.querySelector('.poly-component__title')?.textContent?.trim().slice(0, 40)

      return { title, priceData }
    })
  })

  console.log('=== Seletores de preÃ§o por card ===')
  console.log(JSON.stringify(priceDebug, null, 2))

  await browser.close()
}

main().catch(console.error)
