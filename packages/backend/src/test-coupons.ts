import './env'
import { getAuthenticatedContext } from './providers/mercadolivre/auth'
import { scrapeCouponsAndProducts } from './providers/mercadolivre/scraper-coupons'
import { MercadoLivreProvider } from './providers/mercadolivre'

async function main() {
  const provider = new MercadoLivreProvider()
  const ctx = await getAuthenticatedContext()
  try {
    const coupons = await scrapeCouponsAndProducts(ctx, (url) => provider.buildAffiliateLink(url))
    console.log(`\n=== ${coupons.length} cupons encontrados ===`)
    coupons.forEach(c => {
      console.log(`Cupom: ${c.code} | ${c.discount} | Vence: ${c.expiresAt?.toLocaleDateString('pt-BR') || 'N/A'}`)
      console.log(`  Produtos: ${c.products.length}`)
      c.products.slice(0, 3).forEach(p => console.log(`    - ${p.title} | R$${p.salePrice}`))
    })
  } finally {
    await ctx.browser()?.close()
  }
}

main().catch(console.error)

