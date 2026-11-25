import { AffiliateProvider, RawOffer } from '../base.provider'
import { fetchGenericProduct } from '../html-product'
import { scrapeShopeeFeed } from './feed'

// Link de afiliado sem Open API: o redirecionador oficial do programa,
// https://shope.ee/an_redir?origin_link=<produto>&affiliate_id=<ID>&sub_id=<origem>
// (o mesmo formato do "product_short link" do feed, que vem sem affiliate_id).
// O redirect leva utm_source=an_<ID> + utm_medium=affiliates — testado.
// SHOPEE_AFFILIATE_ID = campo affiliate_id do perfil em affiliate.shopee.com.br.
//
// Listagem: feed de produto diário do portal (ver feed.ts).
// Open API (GraphQL, link curto s.shopee.com.br): a conta não tem acesso —
// o botão "Aplicar" fica desativado; o acesso é pedido ao gerente da conta.

const SUB_ID = 'foxofertas'

export function extractShopeeIds(url: string): { shopId: string; itemId: string } | null {
  // formato slug: produto-i.{shopId}.{itemId}
  let m = url.match(/-?i\.(\d+)\.(\d+)/)
  if (m) return { shopId: m[1], itemId: m[2] }
  // formato /product/{shopId}/{itemId}
  // formato /product/{shopId}/{itemId} ou /opaanlp/{shopId}/{itemId} (destino dos links curtos de afiliado)
  m = url.match(/\/(?:product|opaanlp)\/(\d+)\/(\d+)/)
  if (m) return { shopId: m[1], itemId: m[2] }
  return null
}

export class ShopeeProvider implements AffiliateProvider {
  name = 'shopee'

  buildAffiliateLink(productUrl: string): string {
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID
    const ids = extractShopeeIds(productUrl)
    if (!affiliateId || !ids) {
      console.warn(`[Shopee] Link SEM comissão (${!affiliateId ? 'SHOPEE_AFFILIATE_ID não configurado' : 'URL sem shopId/itemId'}): ${productUrl}`)
      return productUrl
    }
    const origin = `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`
    return `https://shope.ee/an_redir?origin_link=${encodeURIComponent(origin)}&affiliate_id=${affiliateId}&sub_id=${SUB_ID}`
  }

  async scrapeOffers(): Promise<RawOffer[]> {
    return scrapeShopeeFeed()
  }
}

export async function scrapeShopeeProduct(url: string): Promise<RawOffer | null> {
  const ids = extractShopeeIds(url)
  if (!ids) {
    console.error('[Shopee] shopId/itemId não encontrados na URL:', url)
    return null
  }

  const cleanUrl = url.split('#')[0].split('?')[0]
  // Shopee é fortemente protegida contra bots — fetch/Playwright são best-effort;
  // quando falharem, usar o modo de dados manuais do formulário de import.
  const data = await fetchGenericProduct(cleanUrl)
  if (!data) return null

  const discountPct = data.originalPrice > data.salePrice
    ? Math.round((1 - data.salePrice / data.originalPrice) * 100)
    : 0

  return {
    externalId: `SHOPEE-${ids.shopId}-${ids.itemId}`,
    productUrl: cleanUrl,
    discountPct,
    ...data,
  }
}
