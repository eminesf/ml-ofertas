import { getOffer, getOffers, type Offer } from '@/lib/api'
import { brl, storeName } from '@/lib/utils'
import SendButton from './SendButton'

export const dynamic = 'force-dynamic'

// Melhores ofertas das últimas 24h para virar story no Instagram (1–2 por dia).
// Ordem: nota da IA, depois desconto, depois votos.
function rank(o: Offer): number {
  return (o.aiScore ?? 0) * 10 + Math.min(o.discountPct, 70) / 2 + o.upvotes
}

// Link do site → id ou código curto: /oferta/{id}, /r/{code}, /story/{id} ou só o id
function parseSiteLink(input: string): string | null {
  const v = input.trim()
  if (!v) return null
  const m = v.match(/\/(?:oferta|r|story)\/([A-Za-z0-9_-]+)/)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{4,40}$/.test(v) ? v : null
}

function StoryCard({ o, badge, highlight }: { o: Offer; badge?: string; highlight?: boolean }) {
  const link = o.shortCode ? `https://www.foxpromocoes.com.br/r/${o.shortCode}` : `https://www.foxpromocoes.com.br/oferta/${o.id}`
  return (
    <div style={{ background: '#1c1c1f', borderRadius: 12, padding: 12, border: highlight ? '2px solid #FFE600' : '1px solid #333' }}>
      {badge && <div style={{ color: '#FFE600', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>{badge}</div>}
      <a href={`/story/${o.id}`} target="_blank" rel="noreferrer">
        <img src={`/story/${o.id}`} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 8, background: '#000' }} />
      </a>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
        {storeName(o.provider)} · IA {o.aiScore ?? '–'}/10 · -{o.discountPct}% · {brl(o.salePrice)}
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
}

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link: linkParam = '' } = await searchParams
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

  // Oferta escolhida pelo link do site (promoção boa que ficou fora das 8 melhores)
  const key = parseSiteLink(linkParam)
  let picked: Offer | null = null
  if (key) picked = await getOffer(key).catch(() => null)
  const linkError = linkParam && !picked
    ? key ? 'Não achei essa oferta no site.' : 'Link inválido — cole um link do site (/oferta/… ou /r/…).'
    : ''

  return (
    <div style={{ padding: 24, color: '#eee' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Stories do Instagram</h1>
      <p style={{ color: '#999', marginBottom: 6 }}>
        Melhores ofertas das últimas 24h. Baixe a arte, poste no story e adicione a figurinha de <b>Link</b> com o link curto.
      </p>
      <p style={{ color: '#999', marginBottom: 20, fontSize: 13 }}>
        Dica: a parte de baixo da arte fica livre para a figurinha de link.
      </p>

      <form method="get" style={{ background: '#1c1c1f', border: '1px solid #333', borderRadius: 12, padding: 14, marginBottom: 24, maxWidth: 720 }}>
        <label htmlFor="link" style={{ display: 'block', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
          Criar story de um link do site
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            id="link"
            name="link"
            defaultValue={linkParam}
            placeholder="https://www.foxpromocoes.com.br/oferta/… ou /r/…"
            style={{ flex: '1 1 320px', minWidth: 0, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 8, padding: '9px 10px', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button type="submit" style={{ background: '#FFE600', color: '#111', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Gerar arte
          </button>
          {linkParam && (
            <a href="/admin/stories" style={{ alignSelf: 'center', fontSize: 12, color: '#999' }}>limpar</a>
          )}
        </div>
        {linkError && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{linkError}</div>}
        {!picked && (
          <div style={{ color: '#777', fontSize: 12, marginTop: 8 }}>
            Produto que ainda não está no site? Importe primeiro em <a href="/admin/import" style={{ color: '#aaa' }}>Importar oferta</a> e depois cole o link aqui.
          </div>
        )}
        {picked && (
          <div style={{ maxWidth: 260, marginTop: 14 }}>
            <StoryCard o={picked} badge="✎ ESCOLHIDA POR VOCÊ" highlight />
          </div>
        )}
      </form>

      {best.length === 0 && <p>Nenhuma oferta boa nas últimas 24h.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
        {best.map((o, i) => (
          <StoryCard key={o.id} o={o} badge={i === 0 ? '★ MELHOR DO DIA' : undefined} highlight={i === 0} />
        ))}
      </div>
    </div>
  )
}
