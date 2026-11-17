import { AffiliateProvider, RawOffer } from '../base.provider'
import { fetchGenericProduct } from '../html-product'

// A conta ainda NÃO tem acesso à Open API de afiliados da Shopee (AppID pendente
// de aprovação em affiliate.shopee.com.br/open_api). Sem a API não há como gerar
// o link curto de afiliado (s.shopee.com.br/...) programaticamente.
//
// Fluxo atual: o admin gera o link curto no portal ("Link personalizado") e cola
// no campo "Link de afiliado" do formulário de import. Se não informar, o link
// publicado é a própria URL do produto (sem comissão) — o import route avisa.
//
// Quando a Open API for aprovada: implementar generateShortLink via GraphQL
// (open-api.affiliate.shopee.com.br/graphql) com SHOPEE_APP_ID/SHOPEE_APP_SECRET.

export function extractShopeeIds(url: string): { shopId: string; itemId: string } | null {
  // formato slug: produto-i.{shopId}.{itemId}
  let m = url.match(/-?i\.(\d+)\.(\d+)/)
  if (m) return { shopId: m[1], itemId: m[2] }
  // formato /product/{shopId}/{itemId}
  m = url.match(/\/product\/(\d+)\/(\d+)/)
  if (m) return { shopId: m[1], itemId: m[2] }
  return null
}

export class ShopeeProvider implements AffiliateProvider {
  name = 'shopee'

  buildAffiliateLink(productUrl: string): string {
    // Sem Open API não há conversão automática — retorna a URL recebida.
    // O import route substitui pelo link curto quando o admin fornece.
    return productUrl
  }

  async scrapeOffers(): Promise<RawOffer[]> {
    console.log('[Shopee] Scraping de listagem não implementado (usar import por URL)')
    return []
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
