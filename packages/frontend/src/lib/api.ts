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
  shortCode?: string | null
  clicks?: number
  category?: string
  rating?: number
  aiScore?: number
  upvotes: number
  couponAmount?: string
  couponCode?: string
  couponExpiresAt?: string
  couponMinValue?: number | null
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

export async function voteOffer(id: string, type: 'vote' | 'downvote'): Promise<number> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const res = await fetch(`${API_URL}/api/offers/${id}/${type}`, { method: 'POST' })
  if (!res.ok) return 0
  const data = await res.json()
  return data.upvotes
}

export async function getOffers(params?: {
  provider?: string
  category?: string
  page?: number
  limit?: number
  minDiscount?: number
  sort?: 'discount' | 'recent' | 'score' | 'votes'
  q?: string
}): Promise<OffersResponse> {
  const qs = new URLSearchParams()
  if (params?.provider) qs.set('provider', params.provider)
  if (params?.category) qs.set('category', params.category)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.minDiscount) qs.set('minDiscount', String(params.minDiscount))
  if (params?.sort) qs.set('sort', params.sort)
  if (params?.q) qs.set('q', params.q)
  const res = await fetch(`${API_URL}/api/offers?${qs}`, { cache: 'no-store' })
  if (!res.ok) return { offers: [], total: 0, page: 1, limit: 24 }
  return res.json()
}

export async function getOffer(id: string): Promise<Offer | null> {
  const res = await fetch(`${API_URL}/api/offers/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

// Links dos canais (o do WhatsApp vem do grupo via bot). Cache de 10 min.
export async function getChannels(): Promise<{ whatsapp: string | null; telegram: string }> {
  const fallback = { whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL || null, telegram: 'https://t.me/e_foxofertas' }
  try {
    const res = await fetch(`${API_URL}/api/channels`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return fallback
    const data = await res.json()
    return { whatsapp: data.whatsapp || fallback.whatsapp, telegram: data.telegram || fallback.telegram }
  } catch {
    return fallback
  }
}
