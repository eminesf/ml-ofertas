'use client'
import { useCallback, useEffect, useState } from 'react'
import { OfferEditor, FullOffer, GROUP, brl, when, box, input, btn, offersApi as api } from '@/components/admin/OfferEditor'

// Gerenciar uma oferta já no banco: buscar (nome, link do produto, link curto /r/…),
// corrigir link/cor, preço, foto e texto, gerar o texto de novo, postar de novo ou apagar.

interface Row {
  id: string
  externalId: string
  title: string
  provider: string
  source: string
  imageUrl: string | null
  productUrl: string
  salePrice: number
  originalPrice: number
  discountPct: number
  aiScore: number | null
  couponCode: string | null
  shortCode: string | null
  clicks: number
  createdAt: string
  hasCopy: boolean
  group: string
  fresh: boolean
  posts: { channel: string; sentAt: string }[]
}

export default function OfertasPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<FullOffer | null>(null)

  const search = useCallback(async (term: string) => {
    setError('')
    try {
      const data = await api(`?q=${encodeURIComponent(term)}`)
      setRows(data.offers)
      if (data.offers.length === 1) open(data.offers[0].id)
    } catch (err: any) {
      setError(err.message)
      setRows([])
    }
  }, [])

  async function open(id: string) {
    try {
      const data = await api(`/${id}`)
      setSel(data.offer)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    const initial = new URLSearchParams(location.search).get('q') || ''
    setQ(initial)
    search(initial)
  }, [search])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>Ofertas</h1>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
        Busque pelo nome, pelo link do produto (ML, Amazon, Nike…) ou pelo link curto <code>/r/…</code> do post.
      </p>
      <form
        onSubmit={e => { e.preventDefault(); history.replaceState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname); search(q) }}
        style={{ display: 'flex', gap: 8, marginBottom: 14 }}
      >
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ex.: gamma force, https://www.nike.com.br/…, /r/UUpJWK" style={{ ...input, flex: 1 }} />
        <button style={btn('#1a1a2e')}>Buscar</button>
      </form>
      {error && <p style={{ color: '#c00', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {rows === null && <p style={{ fontSize: 13, color: '#888' }}>Carregando…</p>}
          {rows?.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Nada encontrado.</p>}
          {rows?.map(r => (
            <button
              key={r.id}
              onClick={() => open(r.id)}
              style={{ ...box, padding: 10, display: 'flex', gap: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderColor: sel?.id === r.id ? '#1a1a2e' : '#e5e5e5', borderWidth: sel?.id === r.id ? 2 : 1 }}
            >
              {r.imageUrl
                ? <img src={r.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0, borderRadius: 6, background: '#fafafa' }} />
                : <div style={{ width: 56, height: 56, background: '#eee', borderRadius: 6, flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.title}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
                  <b>{brl(r.salePrice)}</b>{r.discountPct > 0 && <> · {r.discountPct}% OFF</>} · {r.provider} · {GROUP[r.group] || r.group}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {r.posts.length ? `postada ${when(r.posts[0].sentAt)}` : r.hasCopy ? (r.fresh ? 'na fila' : 'fora do prazo da fila') : 'sem texto (reprovada/filtrada)'}
                  {r.clicks > 0 && ` · ${r.clicks} cliques`}
                </div>
              </div>
            </button>
          ))}
        </div>

        {sel && <OfferEditor key={sel.id} offer={sel} onChange={setSel} onDeleted={() => { setSel(null); search(q) }} />}
      </div>
    </div>
  )
}
