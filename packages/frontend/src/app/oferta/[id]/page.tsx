import { getOffer, getOffers } from '@/lib/api'
import { notFound } from 'next/navigation'
import OfferCard from '@/components/OfferCard'
import VoteButton from '@/components/VoteButton'

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const offer = await getOffer(id)
  if (!offer) notFound()

  const { offers: related } = await getOffers({ category: offer.category, limit: 6 })
  const relatedOffers = related.filter(o => o.id !== offer.id).slice(0, 4)

  const hasDiscount = offer.originalPrice > offer.salePrice

  return (
    <main style={{ maxWidth: 940, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <a href="/" style={{ color: '#777', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
        ← Voltar às ofertas
      </a>

      <div style={{
        background: '#fff', borderRadius: 16, padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', gap: '2rem', flexWrap: 'wrap',
      }}>
        {/* Imagem */}
        <div style={{ flex: '0 0 auto', width: 300 }}>
          {offer.imageUrl
            ? <img src={offer.imageUrl} alt={offer.title} style={{ width: '100%', objectFit: 'contain', borderRadius: 12, maxHeight: 300 }} />
            : <div style={{ width: '100%', height: 260, background: '#f8f8f8', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🛍️</div>
          }

          {/* Voto na página de detalhe */}
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <VoteButton offerId={offer.id} initialVotes={offer.upvotes ?? 0} />
            <span style={{ fontSize: 13, color: '#888' }}>Essa oferta é boa?</span>
          </div>
        </div>

        {/* Detalhes */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#e53e3e', color: '#fff', fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
              -{offer.discountPct}% OFF
            </span>
            {offer.couponCode && (
              <span style={{ background: '#FFE600', color: '#333', fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                🎟️ Cupom disponível
              </span>
            )}
            {offer.aiScore && (
              <span style={{ background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                ⭐ IA: {offer.aiScore}/10
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 1rem', lineHeight: 1.35 }}>
            {offer.title}
          </h1>

          {offer.rating && (
            <p style={{ margin: '0 0 0.75rem', color: '#666', fontSize: 14 }}>
              ⭐ {offer.rating.toFixed(1)} de avaliação
            </p>
          )}

          {/* Preços */}
          <div style={{ marginBottom: '1rem' }}>
            {hasDiscount && (
              <div style={{ color: '#bbb', fontSize: 15, textDecoration: 'line-through' }}>
                R$ {offer.originalPrice.toFixed(2).replace('.', ',')}
              </div>
            )}
            <div style={{ fontSize: 36, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.1 }}>
              R$ {offer.salePrice.toFixed(2).replace('.', ',')}
            </div>
            {hasDiscount && (
              <div style={{ color: '#2d7d46', fontWeight: 600, fontSize: 14, marginTop: 4 }}>
                Você economiza R$ {(offer.originalPrice - offer.salePrice).toFixed(2).replace('.', ',')}
              </div>
            )}
          </div>

          {/* Cupom */}
          {offer.couponCode && (
            <div style={{
              background: '#fffbe6', border: '2px dashed #e6c800',
              borderRadius: 10, padding: '0.875rem', marginBottom: '1rem',
            }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14 }}>🎟️ Cupom de desconto</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ background: '#fff3b0', padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: 16, border: '1px solid #e6c800' }}>
                  {offer.couponCode}
                </code>
                {offer.couponAmount && (
                  <span style={{ color: '#856404', fontWeight: 600 }}>{offer.couponAmount}</span>
                )}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#856404' }}>
                Copie e aplique no checkout do Mercado Livre
              </p>
            </div>
          )}

          {/* Destaque */}
          {offer.suggestedHighlight && (
            <p style={{ color: '#2d7d46', fontWeight: 600, marginBottom: '1rem', fontSize: 14 }}>
              ✅ {offer.suggestedHighlight}
            </p>
          )}

          {/* CTA */}
          <a
            href={offer.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', background: '#FFE600', color: '#333',
              textAlign: 'center', padding: '14px 24px', borderRadius: 12,
              fontWeight: 700, fontSize: 16, textDecoration: 'none',
              marginBottom: '0.75rem',
            }}
          >
            🛒 Ver oferta no Mercado Livre →
          </a>

          <p style={{ fontSize: 11, color: '#bbb', margin: 0, textAlign: 'center' }}>
            Link de afiliado — o preço é o mesmo para você
          </p>
        </div>
      </div>

      {/* Ofertas relacionadas */}
      {relatedOffers.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Ofertas relacionadas
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {relatedOffers.map(o => <OfferCard key={o.id} offer={o} />)}
          </div>
        </div>
      )}
    </main>
  )
}
