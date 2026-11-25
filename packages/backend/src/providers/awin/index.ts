import { AffiliateProvider, RawOffer } from '../base.provider'
import { fetchGenericProduct } from '../html-product'
import { scrapeAwinFeed, findInFeed } from './feed'

// Publisher ID do painel ui.awin.com (PF - Fox Ofertas e Promoções)
const DEFAULT_AFFILIATE_ID = '2953175'

// Anunciantes aceitos no painel Awin — MIDs extraídos de "Meus Programas"
export interface AwinAdvertiser {
  name: string        // vira Offer.provider no banco
  label: string
  mid: number         // awinmid
  domains: string[]   // hostnames que identificam o anunciante
  feedIds?: string[]  // product feeds (Ferramentas → Crie um Feed → lista de feeds)
  // 'feed' (padrão) = preço "de" vem no feed | 'priceDrop' = feed sem preço "de", desconto = queda vs scrape anterior
  discountSource?: 'feed' | 'priceDrop'
  // desconto mínimo do feed para essa loja (padrão 20%). Stanley quase nunca passa de 20%
  minDiscount?: number
}

export const AWIN_ADVERTISERS: AwinAdvertiser[] = [
  // Feed Kabum só traz preço à vista (custom_3 é o parcelado, ~5% acima — não é desconto real)
  { name: 'kabum', label: 'KaBuM!', mid: 17729, domains: ['kabum.com.br'], feedIds: ['46967'], discountSource: 'priceDrop' },
  // Sem feedIds de propósito: feeds BR & LATAM (47201..47257) vêm em CNY/USD e em inglês — só import por URL
  { name: 'aliexpress', label: 'AliExpress', mid: 18879, domains: ['aliexpress.com', 'pt.aliexpress.com', 'aliexpress.us'] },
  { name: 'stanley', label: 'Stanley', mid: 30599, domains: ['stanley1913.com', 'stanley1913.com.br', 'stanley.com.br'], feedIds: ['72033'], minDiscount: 10 },
  // Nike BR (afiliação aprovada em 24/11/2026). Feed 44669 traz product_price_old (preço "de");
  // o 93360 ("Nike Product Feed - 2024") não tem preço antigo. Vai para o grupo Achadinhos.
  { name: 'nike', label: 'Nike', mid: 17652, domains: ['nike.com.br'], feedIds: ['44669'] },
]

export function findAwinAdvertiser(url: string): AwinAdvertiser | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return AWIN_ADVERTISERS.find(a => a.domains.some(d => host === d || host.endsWith(`.${d}`))) || null
  } catch {
    return null
  }
}

// externalId estável por anunciante a partir da URL do produto
export function awinExternalId(advertiser: AwinAdvertiser, url: string): string {
  try {
    const u = new URL(url)
    if (advertiser.name === 'kabum') {
      // kabum.com.br/produto/{id}/slug
      const m = u.pathname.match(/\/produto\/(\d+)/)
      if (m) return `KABUM-${m[1]}`
    }
    if (advertiser.name === 'aliexpress') {
      // aliexpress.com/item/{id}.html
      const m = u.pathname.match(/\/item\/(\d+)/)
      if (m) return `ALIEXP-${m[1]}`
    }
    if (advertiser.name === 'stanley') {
      // shopify: /products/{handle}
      const m = u.pathname.match(/\/products\/([a-z0-9-]+)/i)
      if (m) return `STANLEY-${m[1].slice(0, 60)}`
    }
    if (advertiser.name === 'nike') {
      // nike.com.br/{slug}-{codigo}.html?cor=XX — cores do mesmo modelo contam como um produto
      // (o link dos grupos às vezes vem sem ?cor; o ID tem de bater com o do feed)
      const m = u.pathname.match(/-(\d{5,})\.html$/)
      if (m) return `NIKE-${m[1]}`
    }
    // fallback: pathname sanitizado
    const slug = u.pathname.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
    return `${advertiser.name.toUpperCase()}-${slug}`
  } catch {
    return `${advertiser.name.toUpperCase()}-${url.slice(-60).replace(/[^a-zA-Z0-9]+/g, '-')}`
  }
}

export class AwinProvider implements AffiliateProvider {
  name: string
  private advertiser: AwinAdvertiser
  private affiliateId: string

  constructor(advertiser: AwinAdvertiser) {
    this.advertiser = advertiser
    this.name = advertiser.name
    this.affiliateId = process.env.AWIN_AFFILIATE_ID || DEFAULT_AFFILIATE_ID
  }

  buildAffiliateLink(productUrl: string): string {
    // Deeplink padrão Awin: awin1.com/cread.php?awinmid={MID}&awinaffid={AFFID}&ued={url}
    return `https://www.awin1.com/cread.php?awinmid=${this.advertiser.mid}&awinaffid=${this.affiliateId}&ued=${encodeURIComponent(productUrl)}`
  }

  // Listagem via product feed da Awin (ver feed.ts) — import por URL continua disponível
  async scrapeOffers(): Promise<RawOffer[]> {
    return scrapeAwinFeed(this.advertiser)
  }
}

export async function scrapeAwinProduct(url: string): Promise<RawOffer | null> {
  const advertiser = findAwinAdvertiser(url)
  if (!advertiser) {
    console.error('[Awin] URL não pertence a nenhum anunciante aceito:', url)
    return null
  }

  const cleanUrl = url.split('#')[0].split('?')[0]
  // Loja com feed (Nike bloqueia leitura direta da página com 403): dados do feed Awin
  if (advertiser.feedIds?.length) {
    const fromFeed = await findInFeed(advertiser, awinExternalId(advertiser, cleanUrl)).catch(() => null)
    if (fromFeed) return fromFeed
  }
  const data = await fetchGenericProduct(cleanUrl)
  if (!data) return null

  const discountPct = data.originalPrice > data.salePrice
    ? Math.round((1 - data.salePrice / data.originalPrice) * 100)
    : 0

  return {
    externalId: awinExternalId(advertiser, cleanUrl),
    productUrl: cleanUrl,
    discountPct,
    ...data,
  }
}
