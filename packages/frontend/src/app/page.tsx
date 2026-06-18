import { getOffers } from '@/lib/api'
import OfferCard from '@/components/OfferCard'
import Filters from '@/components/Filters'

interface SearchParams {
  categoria?: string
  desconto?: string
  ordenar?: string
  pagina?: string
}

export const metadata = {
  title: 'FuchsOfertas — Melhores Ofertas do Dia',
  description: 'Ofertas selecionadas com desconto real do Mercado Livre, avaliadas por IA',
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const page = Number(params.pagina) || 1
  const sort = (params.ordenar as 'discount' | 'recent' | 'score') || 'recent'
  const minDiscount = Number(params.desconto) || undefined

  const { offers, total } = await getOffers({
    limit: 24,
    page,
    sort,
    minDiscount,
    category: params.categoria,
  })

  const topOffer = offers[0]
  const totalPages = Math.ceil(total / 24)

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Banner destaque */}
      {topOffer && (
        <a
          href={`/oferta/${topOffer.id}`}
          style={{
            display: 'flex', gap: '1.5rem', background: '#fff',
            borderRadius: 16, overflow: 'hidden', marginBottom: '2rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textDecoration: 'none', color: 'inherit',
            alignItems: 'center', padding: '1.5rem',
          }}
        >
          {topOffer.imageUrl && (
            <img
              src={topOffer.imageUrl}
              alt={topOffer.title}
              style={{ width: 160, height: 160, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1 }}>
            <span style={{ background: '#e53e3e', color: '#fff', fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
              🔥 Destaque do dia — -{topOffer.discountPct}% OFF
            </span>
            <h2 style={{ margin: '0.75rem 0 0.5rem', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
              {topOffer.title}
            </h2>
            <div>
              {topOffer.originalPrice > topOffer.salePrice && (
                <span style={{ color: '#999', textDecoration: 'line-through', fontSize: 14, marginRight: 8 }}>
                  R$ {topOffer.originalPrice.toFixed(2).replace('.', ',')}
                </span>
              )}
              <span style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a' }}>
                R$ {topOffer.salePrice.toFixed(2).replace('.', ',')}
              </span>
            </div>
            {topOffer.suggestedHighlight && (
              <p style={{ color: '#2d7d46', fontWeight: 600, margin: '0.5rem 0 0', fontSize: 14 }}>
                ✅ {topOffer.suggestedHighlight}
              </p>
            )}
          </div>
          <span style={{
            background: '#FFE600', color: '#333', padding: '12px 24px',
            borderRadius: 10, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Ver oferta →
          </span>
        </a>
      )}

      {/* Título + filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
          Melhores ofertas do dia
          <span style={{ color: '#888', fontWeight: 400, fontSize: '0.9rem', marginLeft: 8 }}>
            ({total} ofertas)
          </span>
        </h1>
        <Filters sort={sort} minDiscount={minDiscount} />
      </div>

      {/* Grid de ofertas */}
      {offers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🛍️</p>
          <p>Nenhuma oferta encontrada com esses filtros.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '1rem',
        }}>
          {offers.map(offer => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
          {page > 1 && (
            <a href={`?pagina=${page - 1}`} style={pageBtn}>← Anterior</a>
          )}
          <span style={{ ...pageBtn, background: '#FFE600', fontWeight: 700 }}>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a href={`?pagina=${page + 1}`} style={pageBtn}>Próxima →</a>
          )}
        </div>
      )}
    </main>
  )
}

const pageBtn: React.CSSProperties = {
  textDecoration: 'none', color: '#333',
  background: '#fff', border: '1px solid #ddd',
  padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14,
}
