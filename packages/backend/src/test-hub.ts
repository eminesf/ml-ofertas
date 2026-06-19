import './env'
import { getAuthenticatedContext } from './providers/mercadolivre/auth'
import { scrapeHubProducts } from './providers/mercadolivre/scraper-hub'
import { scrapeCouponsAndProducts } from './providers/mercadolivre/scraper-coupons'
import { MercadoLivreProvider } from './providers/mercadolivre'

async function main() {
  const provider = new MercadoLivreProvider()
  const ctx = await getAuthenticatedContext()

  try {
    // --- Hub ---
    console.log('\n=== SCRAPING HUB ===')
    const products = await scrapeHubProducts(ctx, (url) => provider.buildAffiliateLink(url))
    console.log(`\n=== ${products.length} produtos coletados do hub ===`)
    products.slice(0, 5).forEach(p => {
      console.log(`- ${p.title} | R$${p.salePrice} (${p.discountPct}% OFF) | ${p.externalId}`)
    })

    // --- Cupons ---
    console.log('\n=== SCRAPING CUPONS ===')
    const coupons = await scrapeCouponsAndProducts(ctx, (url) => provider.buildAffiliateLink(url))
    console.log(`\n=== ${coupons.length} cupons encontrados ===`)
    for (const c of coupons) {
      console.log(`\nCupom: ${c.code} | ${c.discount} | Vence: ${c.expiresAt?.toLocaleDateString('pt-BR') ?? 'sem data'}`)
      console.log(`  ${c.products.length} produtos:`)
      c.products.slice(0, 3).forEach(p => {
        console.log(`  - ${p.title} | R$${p.salePrice} (${p.discountPct}% OFF)`)
      })
    }
  } finally {
    await ctx.browser()?.close()
  }
}

main().catch(console.error)
