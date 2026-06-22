export interface RawOffer {
  externalId: string
  title: string
  originalPrice: number
  salePrice: number
  discountPct: number
  imageUrl?: string
  productUrl: string
  category?: string
  rating?: number
}

export interface AffiliateProvider {
  name: string
  scrapeOffers(): Promise<RawOffer[]>
  buildAffiliateLink(productUrl: string): string
}
