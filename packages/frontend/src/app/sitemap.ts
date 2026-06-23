import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const CATEGORIES = ['eletronicos', 'esporte', 'moda', 'casa', 'beleza', 'automotivo', 'ferramentas']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...CATEGORIES.map(slug => ({
      url: `${BASE_URL}/categoria/${slug}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
  ]

  let offerPages: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(`${API_URL}/api/offers?limit=500&sort=recent`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      offerPages = (data.offers as { id: string; createdAt: string }[]).map(offer => ({
        url: `${BASE_URL}/oferta/${offer.id}`,
        lastModified: new Date(offer.createdAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch {
    // Falha silenciosa — sitemap retorna só as páginas estáticas
  }

  return [...staticPages, ...offerPages]
}
