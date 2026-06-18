import './env'
import { evaluateOffer, analyzeMarketValue, generatePostMessage } from './ai'

const testOffer = {
  externalId: 'MLB123456',
  title: 'Album Panini Copa do Mundo FIFA 26 + 50 Figurinhas',
  originalPrice: 89.90,
  salePrice: 59.90,
  discountPct: 33,
  imageUrl: 'https://via.placeholder.com/300',
  productUrl: 'https://www.mercadolivre.com.br/p/MLB123456',
  rating: 4.8,
  category: 'esporte',
}

async function main() {
  console.log('=== Testando avaliacao de oferta ===')
  const evaluation = await evaluateOffer(testOffer)
  console.log(JSON.stringify(evaluation, null, 2))

  console.log('\n=== Testando analise de mercado ===')
  const market = await analyzeMarketValue(testOffer)
  console.log(JSON.stringify(market, null, 2))

  console.log('\n=== Testando geracao de post ===')
  const post = await generatePostMessage(
    testOffer,
    'https://www.mercadolivre.com.br/p/MLB123456?matt_tool=28042140&matt_word=fuchsecommerce',
    '#FUCHS20OFF',
    market.suggestedHighlight
  )
  console.log('--- TELEGRAM ---')
  console.log(post.telegram)
  console.log('\n--- WHATSAPP ---')
  console.log(post.whatsapp)
}

main().catch(console.error)
