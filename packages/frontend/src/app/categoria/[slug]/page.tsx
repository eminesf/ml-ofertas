import { getOffers } from '@/lib/api'
import OfferCard from '@/components/OfferCard'

const CATEGORY_LABELS: Record<string, string> = {
  'eletrônicos': 'Eletrônicos',
  'eletronicos': 'Eletrônicos',
  'esporte': 'Esporte e Lazer',
  'moda': 'Moda e Roupas',
  'casa': 'Casa e Jardim',
  'geral': 'Geral',
}

interface SearchParams { pagina?: string }

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

  const { offers, total } = await getOffers({ category: decodeURIComponent(slug), limit: 20, page, sort: 'recent' })
  const totalPages = Math.ceil(total / 20)
  const label = CATEGORY_LABELS[slug] || slug

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <a href="/" style={{ color: '#777', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
        ← Início
      </a>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        {label}
        <span style={{ color: '#999', fontWeight: 400, fontSize: '0.9rem', marginLeft: 8 }}>({total})</span>
      </h1>

      {offers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#888' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🛍️</p>
          <p>Nenhuma oferta nessa categoria ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {offers.map(offer => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', marginTop: '2rem' }}>
          {page > 1 && <a href={`?pagina=${page - 1}`} style={pageBtn}>← Anterior</a>}
          <span style={{ ...pageBtn, background: '#FFE600', fontWeight: 700 }}>{page} / {totalPages}</span>
          {page < totalPages && <a href={`?pagina=${page + 1}`} style={pageBtn}>Próxima →</a>}
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
