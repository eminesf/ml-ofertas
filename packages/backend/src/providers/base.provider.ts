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
  // Texto do post de origem (canais/grupos do Telegram): cupom, preço com cupom,
  // condições ("resgate antes da meia-noite", "produto inglês") — vai para a IA do copy
  sourceNote?: string
}

export interface AffiliateProvider {
  name: string
  scrapeOffers(): Promise<RawOffer[]>
  buildAffiliateLink(productUrl: string): string
}
