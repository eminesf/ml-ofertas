import { AffiliateProvider, RawOffer } from './base.provider'
import { MercadoLivreProvider } from './mercadolivre'
import { scrapeProductByUrl } from './mercadolivre/scraper-product'
import { AmazonProvider, extractAsin } from './amazon'
import { scrapeAmazonProduct } from './amazon/scraper-product'
import { AwinProvider, findAwinAdvertiser, awinExternalId, scrapeAwinProduct } from './awin'
import { ShopeeProvider, extractShopeeIds, scrapeShopeeProduct } from './shopee'

export interface ResolvedProvider {
  provider: AffiliateProvider
  externalId: string
  scrapeProduct: (url: string) => Promise<RawOffer | null>
}

// Detecta o provider pela URL e devolve provider + externalId + scraper de produto.
// Retorna null quando a URL não pertence a nenhuma plataforma suportada.
export function resolveProviderByUrl(url: string): ResolvedProvider | null {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }

  // Mercado Livre — mantém externalId MLB{digits} (compatível com banco existente)
  if (host.includes('mercadolivre.com.br') || host.includes('mercadolibre.com')) {
    const idMatch = url.match(/MLB-?(\d+)/)
    if (!idMatch) return null
    return {
      provider: new MercadoLivreProvider(),
      externalId: `MLB${idMatch[1]}`,
      scrapeProduct: scrapeProductByUrl,
    }
  }

  // Amazon
  if (host.includes('amazon.com.br') || host === 'amzn.to') {
    const asin = extractAsin(url)
    if (!asin) return null
    return {
      provider: new AmazonProvider(),
      externalId: `AMZN-${asin}`,
      scrapeProduct: scrapeAmazonProduct,
    }
  }

  // Shopee
  if (host.includes('shopee.com.br')) {
    const ids = extractShopeeIds(url)
    if (!ids) return null
    return {
      provider: new ShopeeProvider(),
      externalId: `SHOPEE-${ids.shopId}-${ids.itemId}`,
      scrapeProduct: scrapeShopeeProduct,
    }
  }

  // Awin (Kabum / AliExpress / Stanley)
  const advertiser = findAwinAdvertiser(url)
  // Link curto do AliExpress (s.click…/e/_xxx, a.aliexpress.com/_xxx) não tem o ID do item:
  // devolve null para o import seguir o redirect (resolveProduct) até /item/{id}.html.
  // Sem isso o externalId saía do slug e o deeplink embrulhava o link do outro afiliado.
  if (advertiser?.name === 'aliexpress' && !/\/item\/\d+/.test(url)) return null
  if (advertiser) {
    return {
      provider: new AwinProvider(advertiser),
      externalId: awinExternalId(advertiser, url.split('#')[0].split('?')[0]),
      scrapeProduct: scrapeAwinProduct,
    }
  }

  return null
}

// Labels amigáveis por provider — usados em logs e respostas de API
export const PROVIDER_LABELS: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  shopee: 'Shopee',
  kabum: 'KaBuM!',
  aliexpress: 'AliExpress',
  stanley: 'Stanley',
  nike: 'Nike',
}
