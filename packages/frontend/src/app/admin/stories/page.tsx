import { getOffers, type Offer } from '@/lib/api'
import { brl, storeName } from '@/lib/utils'
import SendButton from './SendButton'

export const dynamic = 'force-dynamic'

// Melhores ofertas das últimas 24h para virar story no Instagram (1–2 por dia).
// Ordem: nota da IA, depois desconto, depois votos.
function rank(o: Offer): number {
  return (o.aiScore ?? 0) * 10 + Math.min(o.discountPct, 70) / 2 + o.upvotes
}

export default async function StoriesPage() {
  const since = Date.now() - 24 * 60 * 60 * 1000
  let offers: Offer[] = []
  try {
    offers = (await getOffers({ sort: 'recent', limit: 100 })).offers
  } catch {
    // API fora do ar
  }
  const best = offers
    .filter(o => new Date(o.createdAt).getTime() >= since && o.imageUrl && (o.aiScore ?? 0) >= 6)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 8)

  return (
    <div style={{ padding: 24, color: '#eee' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Stories do Instagram</h1>
      <p style={{ color: '#999', marginBottom: 6 }}>
        Melhores ofertas das últimas 24h. Baixe a arte, poste no story e adicione a figurinha de <b>Link</b> com o link curto.
      </p>
      <p style={{ color: '#999', marginBottom: 20, fontSize: 13 }}>
        Dica: a parte de baixo da arte fica livre para a figurinha de link.
      </p>

      {best.length === 0 && <p>Nenhuma oferta boa nas últimas 24h.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
        {best.map((o, i) => {
          const link = o.shortCode ? `https://www.foxpromocoes.com.br/r/${o.shortCode}` : `https://www.foxpromocoes.com.br/oferta/${o.id}`
          return (
            <div key={o.id} style={{ background: '#1c1c1f', borderRadius: 12, padding: 12, border: i === 0 ? '2px solid #FFE600' : '1px solid #333' }}>
              {i === 0 && <div style={{ color: '#FFE600', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>★ MELHOR DO DIA</div>}
              <a href={`/story/${o.id}`} target="_blank" rel="noreferrer">
                <img src={`/story/${o.id}`} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 8, background: '#000' }} />
              </a>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
                {storeName(o.provider)} · IA {o.aiScore}/10 · -{o.discountPct}% · {brl(o.salePrice)}
              </div>
              <a href={`/oferta/${o.id}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#eee', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.title} ↗
              </a>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <a href={`/story/${o.id}?d=1`} style={{ flex: 1, textAlign: 'center', background: '#FFE600', color: '#111', fontWeight: 800, borderRadius: 8, padding: '8px 0', fontSize: 13 }}>
                  Baixar arte
                </a>
                <SendButton id={o.id} alreadyPosted={(o.posts?.length ?? 0) > 0} />
              </div>
              <input readOnly value={link} style={{ width: '100%', marginTop: 8, background: '#111', color: '#ddd', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
              <a href={o.productUrl} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11, color: '#888', marginTop: 6 }}>
                Abrir produto na loja ↗
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
