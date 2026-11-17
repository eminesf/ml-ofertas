import './env'
import { resolveProviderByUrl } from './providers/registry'
import { AmazonProvider } from './providers/amazon'

// Diagnóstico dos providers multi-plataforma — NÃO grava no banco, NÃO posta.
//
// Uso:
//   npm run test:providers -- <url-de-produto>   → resolve provider, scrapa e mostra link de afiliado
//   npm run test:providers -- --amazon-deals     → testa o scraper de listagem /deals da Amazon

async function main() {
  const arg = process.argv[2]

  if (!arg) {
    console.log('Uso: npm run test:providers -- <url> | --amazon-deals')
    process.exit(1)
  }

  if (arg === '--amazon-deals') {
    const provider = new AmazonProvider()
    const offers = await provider.scrapeOffers()
    console.log(`\n=== ${offers.length} ofertas da Amazon ===`)
    for (const o of offers.slice(0, 10)) {
      console.log(`- [${o.externalId}] ${o.title.slice(0, 60)} | R$${o.salePrice} (${o.discountPct}% OFF)`)
    }
    if (offers[0]) {
      console.log(`\nLink afiliado exemplo: ${provider.buildAffiliateLink(offers[0].productUrl)}`)
    }
    process.exit(0)
  }

  const resolved = resolveProviderByUrl(arg)
  if (!resolved) {
    console.error('URL não reconhecida por nenhum provider')
    process.exit(1)
  }

  console.log(`Provider: ${resolved.provider.name}`)
  console.log(`externalId: ${resolved.externalId}`)
  console.log(`Link afiliado: ${resolved.provider.buildAffiliateLink(arg.split('#')[0].split('?')[0])}`)

  console.log('\nScrapando produto...')
  const offer = await resolved.scrapeProduct(arg)
  if (!offer) {
    console.error('❌ Scraper não extraiu dados (usar dados manuais no import)')
    process.exit(1)
  }
  console.log(JSON.stringify(offer, null, 2))
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
