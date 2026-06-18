import './env'
import { getAuthenticatedContext } from './providers/mercadolivre/auth'
import { scrapeHubProducts } from './providers/mercadolivre/scraper-hub'
import { MercadoLivreProvider } from './providers/mercadolivre'

async function main() {
  const provider = new MercadoLivreProvider()
  const ctx = await getAuthenticatedContext()
  try {
    const products = await scrapeHubProducts(ctx, (url) => provider.buildAffiliateLink(url))
    console.log(`\n=== ${products.length} produtos coletados do hub ===`)
    products.slice(0, 5).forEach(p => {
      console.log(`- ${p.title} | R$${p.salePrice} (${p.discountPct}% OFF) | ${p.externalId}`)
    })
  } finally {
    await ctx.browser()?.close()
  }
}

main().catch(console.error)

