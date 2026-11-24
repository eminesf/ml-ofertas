'use client'
import { useCallback, useEffect, useState } from 'react'

// Ofertas aprovadas pela IA que ainda não foram para os grupos. "Enviar" posta na
// hora no Telegram e no WhatsApp (fura a fila e o horário de posting).

interface QueueOffer {
  id: string
  title: string
  provider: string
  source: string
  category: string | null
  imageUrl: string | null
  salePrice: number
  originalPrice: number
  discountPct: number
  aiScore: number | null
  couponCode: string | null
  createdAt: string
  group: string
}

interface GroupTab {
  key: string
  label: string
  configured: boolean
  count: number
}

type SendState = 'sending' | 'sent' | { error: string }

const SOURCE_LABEL: Record<string, string> = {
  telegram: 'Canal Telegram', hub: 'Hub ML', 'offers-page': 'Ofertas do dia', coupon: 'Cupom', manual: 'Manual',
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}

export default function FilaPage() {
  const [hours, setHours] = useState(24)
  const [offers, setOffers] = useState<QueueOffer[] | null>(null)
  const [groups, setGroups] = useState<GroupTab[]>([])
  const [tab, setTab] = useState('tech')
  const [error, setError] = useState('')
  const [state, setState] = useState<Record<string, SendState>>({})

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(`/api/admin/queue?hours=${hours}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setOffers(data.offers)
      setGroups(data.groups || [])
    } catch (err: any) {
      setError(err.message)
      setOffers([])
    }
  }, [hours])

  useEffect(() => { load() }, [load])

  async function send(id: string) {
    setState(s => ({ ...s, [id]: 'sending' }))
    try {
      const res = await fetch(`/api/admin/send/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setState(s => ({ ...s, [id]: 'sent' }))
    } catch (err: any) {
      setState(s => ({ ...s, [id]: { error: err.message } }))
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>Fila — ofertas que não foram para os grupos</h1>
        <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}>
          <option value={6}>Últimas 6h</option>
          <option value={24}>Últimas 24h</option>
          <option value={48}>Últimas 48h</option>
          <option value={72}>Últimas 72h</option>
        </select>
        <button onClick={load} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
          Atualizar
        </button>
      </div>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
        Aprovadas pela IA, na ordem em que o bot postaria. <b>Enviar</b> posta agora no Telegram e no grupo do WhatsApp da aba.
      </p>

      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #e5e5e5', marginBottom: 16 }}>
        {groups.map(g => (
          <button
            key={g.key}
            onClick={() => setTab(g.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '8px 14px', marginBottom: -2, fontSize: 14,
              fontWeight: tab === g.key ? 800 : 500,
              color: tab === g.key ? '#111' : '#777',
              borderBottom: tab === g.key ? '3px solid #FFE600' : '3px solid transparent',
            }}
          >
            {g.label} <span style={{ background: '#eee', borderRadius: 10, padding: '1px 7px', fontSize: 12, marginLeft: 4 }}>{g.count}</span>
            {!g.configured && <span style={{ color: '#c00', fontSize: 11, marginLeft: 6 }}>(grupo não configurado)</span>}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#c00' }}>{error}</p>}
      {offers === null && <p>Carregando…</p>}
      {offers && !error && !offers.some(o => !groups.length || o.group === tab) && <p>Nada na fila deste grupo. Tudo que foi aprovado já foi postado.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {offers?.filter(o => !groups.length || o.group === tab).map(o => {
          const st = state[o.id]
          return (
            <div key={o.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #e5e5e5', opacity: st === 'sent' ? 0.5 : 1 }}>
              {o.imageUrl
                ? <img src={o.imageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }} />
                : <div style={{ width: 64, height: 64, background: '#f3f3f3', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/oferta/${o.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14, color: '#111', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.title}
                </a>
                <div style={{ fontSize: 13, marginTop: 3 }}>
                  <b>{brl(o.salePrice)}</b>
                  {o.discountPct > 0 && <span style={{ color: '#c00', marginLeft: 6 }}>-{o.discountPct}%</span>}
                  {o.couponCode && <span style={{ color: '#b45309', marginLeft: 6 }}>🎟️ {o.couponCode}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  IA {o.aiScore}/10 · {o.provider} · {SOURCE_LABEL[o.source] || o.source} · há {ago(o.createdAt)}
                  {!o.imageUrl && ' · sem imagem'}
                </div>
                {typeof st === 'object' && <div style={{ fontSize: 12, color: '#c00', marginTop: 2 }}>{st.error}</div>}
              </div>
              <button
                onClick={() => send(o.id)}
                disabled={st === 'sending' || st === 'sent'}
                style={{
                  background: st === 'sent' ? '#16a34a' : '#FFE600', color: st === 'sent' ? '#fff' : '#111',
                  border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 800, fontSize: 13,
                  cursor: st === 'sending' || st === 'sent' ? 'default' : 'pointer', flexShrink: 0, minWidth: 96,
                }}
              >
                {st === 'sending' ? 'Enviando…' : st === 'sent' ? 'Enviada ✓' : 'Enviar'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
