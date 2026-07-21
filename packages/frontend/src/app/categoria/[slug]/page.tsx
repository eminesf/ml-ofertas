import { Suspense } from 'react'
import { getOffers } from '@/lib/api'
import OfferCard from '@/components/OfferCard'
import SearchBar from '@/components/SearchBar'

const CATEGORY_LABELS: Record<string, string> = {
  'eletronicos': 'Eletrônicos',
  'esporte': 'Esporte e Suplementos',
  'moda': 'Moda e Acessórios',
  'casa': 'Casa e Eletrodomésticos',
  'beleza': 'Beleza e Cuidados',
  'automotivo': 'Automotivo',
  'ferramentas': 'Ferramentas',
  'geral': 'Geral',
}

interface SearchParams { pagina?: string; q?: string }

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const sp = await searchParams
  const page = Number(sp.pagina) || 1
  const q = sp.q?.trim() || undefined
  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : ''

  const { offers, total } = await getOffers({ category: decodeURIComponent(slug), limit: 20, page, sort: 'recent', q })
  const totalPages = Math.ceil(total / 20)
  const label = CATEGORY_LABELS[slug] || slug

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <a href="/" className="back-btn">← Início</a>

      <Suspense fallback={<div className="search-bar-wrap" style={{ height: 52 }} />}>
        <SearchBar />
      </Suspense>

      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        {label}
        <span style={{ color: '#999', fontWeight: 400, fontSize: '0.9rem', marginLeft: 8 }}>({total})</span>
      </h1>

      {q && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', fontSize: 14, color: '#555' }}>
          <span>Resultados para <strong>&quot;{q}&quot;</strong></span>
          <a href={`/categoria/${slug}`} style={{ color: '#a15c00', textDecoration: 'underline', fontSize: 13 }}>limpar busca</a>
        </div>
      )}

      {offers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#888' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🛍️</p>
          <p>{q ? <>Nenhuma oferta encontrada para &quot;{q}&quot;.</> : 'Nenhuma oferta nessa categoria ainda.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {offers.map(offer => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', marginTop: '2rem' }}>
          {page > 1 && <a href={`?pagina=${page - 1}${qSuffix}`} style={pageBtn}>← Anterior</a>}
          <span style={{ ...pageBtn, background: '#FFE600', fontWeight: 700 }}>{page} / {totalPages}</span>
          {page < totalPages && <a href={`?pagina=${page + 1}${qSuffix}`} style={pageBtn}>Próxima →</a>}
        </div>
      )}
    </main>
  )
}

const pageBtn: React.CSSProperties = {
  textDecoration: 'none', color: '#555',
  background: '#fff', border: '1px solid #ddd',
  padding: '7px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13,
}
