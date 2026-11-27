// Anúncio de Black Friday (Meta): ad-blackfriday-feed.png (1080x1350) e ad-blackfriday-story.png (1080x1920)
// Uso (na raiz): node marketing/flyer/render-ad.cjs
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const icon = fs.readFileSync(path.resolve(__dirname, '../../packages/frontend/src/components/WhatsAppIcon.tsx'), 'utf8').match(/d="[^"]*"/)[0]
  const src = fs.readFileSync(path.join(__dirname, 'ad-blackfriday.src.html'), 'utf8').split('{{WA}}').join(icon)
  fs.writeFileSync(path.join(__dirname, 'ad-blackfriday.html'), src)
  const html = 'file:///' + path.resolve(__dirname, 'ad-blackfriday.html').replace(/\\/g, '/')

  const browser = await chromium.launch()
  for (const [name, h, hash] of [['feed', 1350, ''], ['story', 1920, '#story']]) {
    const page = await browser.newPage({ viewport: { width: 1080, height: h } })
    await page.goto(html + hash, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(__dirname, `ad-blackfriday-${name}.png`) })
    await page.close()
  }
  await browser.close()
  console.log('ok')
})()
