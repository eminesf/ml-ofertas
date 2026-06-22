import './env'
import { MercadoLivreProvider } from './providers/mercadolivre'

async function main() {
  const provider = new MercadoLivreProvider()

  const offers = await provider.scrapeOffers()
  console.log('Ofertas:', JSON.stringify(offers.slice(0, 3), null, 2))
}

main().catch(console.error)

