const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Post {
  id: string
  channel: string
  message: string
  whatsappMessage?: string
  sentAt: string
  success: boolean
}

export interface Offer {
  id: string
  provider: string
  title: string
  originalPrice: number
  salePrice: number
  discountPct: number
  imageUrl?: string
  affiliateUrl: string
  productUrl: string
  category?: string
  rating?: number
  aiScore?: number
  couponAmount?: string
  couponCode?: string
  couponExpiresAt?: string
  suggestedHighlight?: string
  telegramMessage?: string
  whatsappMessage?: string
  source?: string
  createdAt: string
  posts: Post[]
}

export interface OffersResponse {
  offers: Offer[]
  total: number
  page: number
  limit: number
}

export async function getOffers(params?: {
  provider?: string
  category?: string
  page?: number
  limit?: number
  minDiscount?: number
  sort?: 'discount' | 'recent' | 'score'
}): Promise<OffersResponse> {
  const qs = new URLSearchParams()
  if (params?.provider) qs.set('provider', params.provider)
  if (params?.category) qs.set('category', params.category)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.minDiscount) qs.set('minDiscount', String(params.minDiscount))
  if (params?.sort) qs.set('sort', params.sort)
  const res = await fetch(`${API_URL}/api/offers?${qs}`, { next: { revalidate: 300 } })
  if (!res.ok) return { offers: [], total: 0, page: 1, limit: 24 }
  return res.json()
}

export async function getOffer(id: string): Promise<Offer | null> {
  const res = await fetch(`${API_URL}/api/offers/${id}`, { next: { revalidate: 300 } })
  if (!res.ok) return null
  return res.json()
}
