import './env'
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({
    headless: false, // visÃ­vel pra ver o que acontece
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ]
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
  })

  const page = await context.newPage()

  // Remove o flag de webdriver que delata o Playwright
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  console.log('Abrindo pÃ¡gina de ofertas...')
  await page.goto('https://www.mercadolivre.com.br/ofertas', {
    waitUntil: 'networkidle',
    timeout: 60000
  })

  await page.waitForTimeout(3000)

  // Pega o tÃ­tulo da pÃ¡gina pra ver se carregou ou foi bloqueado
  const title = await page.title()
  console.log('TÃ­tulo da pÃ¡gina:', title)

  // Conta quantos elementos poly-card existem
  const polyCardCount = await page.$$eval('.poly-card', els => els.length).catch(() => 0)
  console.log('Elementos .poly-card encontrados:', polyCardCount)

  // Se nÃ£o achou, pega todas as classes do body pra inspecionar
  if (polyCardCount === 0) {
    const allClasses = await page.$$eval('*', els =>
      [...new Set(els.flatMap(el => [...el.classList]))]
        .filter(c => c.length > 3)
        .slice(0, 50)
    )
    console.log('Classes na pÃ¡gina:', allClasses)

    // Pega o HTML do primeiro li ou article que encontrar
    const firstItem = await page.$eval(
      'li, article, [class*="item"], [class*="card"], [class*="result"]',
      el => ({ tag: el.tagName, classes: [...el.classList].join(' '), html: el.innerHTML.slice(0, 300) })
    ).catch(() => null)
    console.log('Primeiro item encontrado:', firstItem)
  }

  await page.screenshot({ path: 'debug-headful.png' })
  console.log('Screenshot salvo: debug-headful.png')

  await page.waitForTimeout(2000)
  await browser.close()
}

main().catch(console.error)
