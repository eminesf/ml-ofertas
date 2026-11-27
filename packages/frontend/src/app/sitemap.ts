import { MetadataRoute } from 'next'
import { SITE_URL as BASE_URL } from '@/lib/site'
import { STORE_PAGES } from '@/lib/seo-pages'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const CATEGORIES = ['pokemon', 'eletronicos', 'esporte', 'moda', 'casa', 'beleza', 'automotivo', 'ferramentas']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...['tech', 'achadinhos'].map(k => ({ url: `${BASE_URL}/grupo/${k}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 })),
    { url: `${BASE_URL}/black-friday`, lastModified: now, changeFrequency: 'hourly', priority: 0.95 },
    { url: `${BASE_URL}/cupons`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    ...STORE_PAGES.map(s => ({ url: `${BASE_URL}/cupom/${s.slug}`, lastModified: now, changeFrequency: 'hourly' as const, priority: 0.85 })),
    ...CATEGORIES.map(slug => ({
      url: `${BASE_URL}/categoria/${slug}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
  ]

  // A API devolve no máx. 100 por página: busca até 10 páginas (1.000 ofertas)
  let offerPages: MetadataRoute.Sitemap = []
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${API_URL}/api/offers?limit=100&page=${page}&sort=recent`, { next: { revalidate: 3600 } })
      if (!res.ok) break
      const data = (await res.json()) as { offers: { id: string; createdAt: string }[] }
      offerPages.push(...data.offers.map(offer => ({
        url: `${BASE_URL}/oferta/${offer.id}`,
        lastModified: new Date(offer.createdAt),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })))
      if (data.offers.length < 100) break
    }
  } catch {
    // Falha silenciosa — sitemap retorna o que conseguiu
  }

  return [...staticPages, ...offerPages]
}
