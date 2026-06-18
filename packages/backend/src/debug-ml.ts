import './env'
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  await page.goto('https://www.mercadolivre.com.br/ofertas', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })

  await page.waitForTimeout(5000)

  const classes = await page.$$eval('*', els =>
    [...new Set(
      els.flatMap(el => [...el.classList])
         .filter(c => /card|item|product|oferta|poly|shelf/i.test(c))
    )].slice(0, 30)
  )

  console.log('Classes encontradas:', classes)

  await page.screenshot({ path: 'debug-ofertas.png', fullPage: false })
  console.log('Screenshot salvo em debug-ofertas.png')

  await browser.close()
}

main().catch(console.error)
