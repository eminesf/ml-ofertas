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

export interface RawCoupon {
  code: string
  discount: string
  minValue?: number
  category?: string
  expiresAt?: Date
}

export interface AffiliateProvider {
  name: string
  scrapeOffers(): Promise<RawOffer[]>
  scrapeCoupons(): Promise<RawCoupon[]>
  buildAffiliateLink(productUrl: string): string
}
