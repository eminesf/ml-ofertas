import { Offer } from '@/lib/api'
import VoteButton from './VoteButton'
import CouponCopy from './CouponCopy'

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div style={{
      display: 'flex', background: '#fff', borderRadius: 12,
      border: '1px solid #e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      overflow: 'hidden', transition: 'box-shadow 0.2s',
    }}>
      {/* Coluna de voto */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: 58, flexShrink: 0, background: '#fafafa', borderRight: '1px solid #f0f0f0',
      }}>
        <VoteButton offerId={offer.id} initialVotes={offer.upvotes ?? 0} />
      </div>

      {/* Imagem */}
      <a
        href={`/oferta/${offer.id}`}
        style={{ display: 'block', flexShrink: 0, width: 110, background: '#f8f8f8', textDecoration: 'none' }}
      >
        {offer.imageUrl
          ? <img src={offer.imageUrl} alt={offer.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🛍️</div>
        }
      </a>

      {/* Informações */}
      <a
        href={`/oferta/${offer.id}`}
        style={{ flex: 1, padding: '10px 12px', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0 }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {offer.discountPct > 0 ? (
            <span style={{ background: '#e53e3e', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              -{offer.discountPct}% OFF
            </span>
          ) : (
            <span style={{ background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              ⚡ Oferta especial!
            </span>
          )}
          {offer.couponCode && (
            <CouponCopy code={offer.couponCode} variant="badge" minValue={offer.couponMinValue} />
          )}
        </div>

        <p style={{
          margin: 0, fontSize: 14, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {offer.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', lineHeight: 1 }}>
            R$ {offer.salePrice.toFixed(2).replace('.', ',')}
          </span>
          {offer.originalPrice > offer.salePrice && (
            <span style={{ fontSize: 12, color: '#bbb', textDecoration: 'line-through' }}>
              R$ {offer.originalPrice.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, color: '#999', fontSize: 11, flexWrap: 'wrap', alignItems: 'center' }}>
          {offer.rating && <span>⭐ {offer.rating.toFixed(1)}</span>}
          <span>{timeAgo(offer.createdAt)}</span>
          {offer.suggestedHighlight && (
            <span className="offer-highlight" style={{ color: '#2d7d46', fontWeight: 600 }}>✅ {offer.suggestedHighlight}</span>
          )}
        </div>
      </a>

      {/* CTA */}
      <div className="offer-cta" style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', flexShrink: 0 }}>
        <a
          href={`/oferta/${offer.id}`}
          className="btn-cta"
          style={{
            background: '#FFE600', color: '#333',
            padding: '10px 14px', borderRadius: 10,
            fontWeight: 700, fontSize: 13, textDecoration: 'none',
            textAlign: 'center', whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          Ver oferta →
        </a>
      </div>
    </div>
  )
}
