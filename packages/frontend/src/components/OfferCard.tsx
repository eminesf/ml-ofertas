import { Offer } from '@/lib/api'

interface Props {
  offer: Offer
}

export default function OfferCard({ offer }: Props) {
  return (
    <a
      href={`/oferta/${offer.id}`}
      style={{
        display: 'flex', flexDirection: 'column',
        border: '1px solid #e5e5e5', borderRadius: 12,
        overflow: 'hidden', textDecoration: 'none',
        color: 'inherit', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        position: 'relative',
      }}
    >
      {/* Badge de desconto */}
      <span style={{
        position: 'absolute', top: 10, left: 10, zIndex: 2,
        background: '#e53e3e', color: '#fff',
        fontSize: 12, fontWeight: 700,
        padding: '3px 8px', borderRadius: 20,
      }}>
        -{offer.discountPct}% OFF
      </span>

      {/* Badge de cupom */}
      {offer.couponCode && (
        <span style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          background: '#FFE600', color: '#333',
          fontSize: 11, fontWeight: 700,
          padding: '3px 8px', borderRadius: 20,
        }}>
          🎟️ Cupom
        </span>
      )}

      {/* Imagem */}
      <div style={{ height: 200, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {offer.imageUrl
          ? <img src={offer.imageUrl} alt={offer.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
          : <span style={{ fontSize: 40 }}>🛍️</span>
        }
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{
          fontSize: 13, lineHeight: 1.4, margin: 0, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {offer.title}
        </p>

        {/* Avaliação */}
        {offer.rating && (
          <span style={{ fontSize: 12, color: '#888' }}>
            ⭐ {offer.rating.toFixed(1)}
          </span>
        )}

        {/* Preços */}
        <div>
          {offer.originalPrice > offer.salePrice && (
            <span style={{ color: '#999', fontSize: 12, textDecoration: 'line-through', display: 'block' }}>
              R$ {offer.originalPrice.toFixed(2).replace('.', ',')}
            </span>
          )}
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>
            R$ {offer.salePrice.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {/* Cupom */}
        {offer.couponCode && (
          <div style={{ background: '#fffbe6', border: '1px dashed #e6c800', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
            🎟️ <strong>{offer.couponCode}</strong>
            {offer.couponAmount && ` — ${offer.couponAmount}`}
          </div>
        )}

        {/* Destaque */}
        {offer.suggestedHighlight && (
          <span style={{ fontSize: 11, color: '#2d7d46', fontWeight: 600 }}>
            ✅ {offer.suggestedHighlight}
          </span>
        )}

        {/* CTA */}
        <span style={{
          background: '#FFE600', color: '#333',
          textAlign: 'center', padding: '9px', borderRadius: 8,
          fontSize: 13, fontWeight: 700, marginTop: 4,
        }}>
          Ver oferta →
        </span>
      </div>
    </a>
  )
}
