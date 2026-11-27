'use client'
import { useEffect, useRef, useState } from 'react'
import { OfferEditor, offersApi, type FullOffer } from '@/components/admin/OfferEditor'

// Grupo de avisos da Nike (grupo-fonte do WhatsApp): cada mensagem com os links já trocados
// pelos nossos (Awin → /r/CODE) e o cupom em destaque. Dá para copiar, editar e mandar para o
// grupo Achadinhos + canal do Telegram. Também aceita texto colado à mão.

interface Link { original: string; store: string | null; short: string | null }
interface Converted { links: Link[]; coupons: string[]; whatsapp: string; telegram: string }
interface Message extends Converted { id: string; at: number; text: string; image: boolean }

const box: React.CSSProperties = { minWidth: 0, overflowWrap: 'anywhere', background: '#1c1c1f', border: '1px solid #333', borderRadius: 12, padding: 14 }
const btn: React.CSSProperties = { border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const area: React.CSSProperties = { width: '100%', minHeight: 150, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.4 }

function timeAgo(at: number) {
  const min = Math.round((Date.now() - at) / 60000)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `há ${h}h` : new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })}
      style={{ ...btn, padding: '6px 10px', fontSize: 12, background: done ? '#16a34a' : '#333', color: '#fff' }}
    >
      {done ? 'Copiado ✓' : label}
    </button>
  )
}

const input: React.CSSProperties = { background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 8, padding: '9px 10px', fontSize: 13, fontFamily: 'inherit', minWidth: 0 }

export interface AnalyzeRequest { url: string; coupon: string; key: number }

// Link de produto + cupom → mesmo pipeline do /admin/import (lê o produto, IA, texto com o
// cupom) e prévia editável com "Postar agora". Produto que já está no banco é reanalisado.
function AnalyzeForm({ request }: { request: AnalyzeRequest | null }) {
  const [url, setUrl] = useState('')
  const [coupon, setCoupon] = useState('')
  const [discount, setDiscount] = useState('')
  const [minValue, setMinValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offer, setOffer] = useState<FullOffer | null>(null)
  const [posted, setPosted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // "Analisar" num link de uma mensagem preenche o formulário
  useEffect(() => {
    if (!request) return
    setUrl(request.url)
    setCoupon(request.coupon)
    const pct = request.coupon.match(/(\d{2})$/)?.[1]
    if (pct && !discount) setDiscount(`${pct}%`)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  async function analyze(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setOffer(null)
    setPosted(false)
    try {
      const body: Record<string, unknown> = { url: url.trim(), preview: true, reanalyze: true }
      if (coupon.trim()) {
        body.couponCode = coupon.trim().toUpperCase()
        if (discount.trim()) body.couponDiscount = /^\d+$/.test(discount.trim()) ? `${discount.trim()}%` : discount.trim()
        if (minValue.trim()) body.couponMinValue = Number(minValue.replace(',', '.'))
      }
      const res = await fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) {
        const hotsite = /\/(hotsite|busca)\b/.test(url) || !/-\d{5,}\.html/.test(url)
        throw new Error(hotsite && /nike\.com/.test(url)
          ? 'Esse link não é de um produto só (hotsite/busca) — use o link curto da mensagem abaixo.'
          : data.error || `Erro ${res.status}`)
      }
      setOffer((await offersApi(`/${data.offer.id}`)).offer)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} style={{ ...box, marginBottom: 24, scrollMarginTop: 16 }}>
      <b style={{ fontSize: 15 }}>Analisar produto com cupom</b>
      <p style={{ color: '#999', fontSize: 12, margin: '4px 0 10px' }}>
        Cole o link do produto e o cupom. O sistema lê o produto, a IA avalia e escreve o post com o cupom. Nada é postado até você clicar em “Postar agora”.
      </p>
      <form onSubmit={analyze} style={{ display: 'grid', gap: 8 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.nike.com.br/…-123456.html?cor=XX" required style={input} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="Cupom (ex.: NIKE40)" style={{ ...input, flex: '1 1 140px', textTransform: 'uppercase' }} />
          <input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Desconto (40% ou R$ 50)" style={{ ...input, flex: '1 1 140px' }} />
          <input value={minValue} onChange={e => setMinValue(e.target.value)} placeholder="Compra mínima (opcional)" inputMode="decimal" style={{ ...input, flex: '1 1 140px' }} />
          <button type="submit" disabled={loading || !url.trim()} style={{ ...btn, background: '#FFE600', color: '#111' }}>
            {loading ? 'Analisando… (até 1 min)' : 'Analisar'}
          </button>
        </div>
      </form>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{error}</div>}
      {offer && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: posted ? '#4ade80' : '#fbbf24' }}>
            {posted
              ? '✅ Postado no Telegram e no grupo.'
              : offer.telegramMessage
                ? `👀 Prévia — confira preço, foto e texto.${offer.aiScore != null ? ` IA: ${offer.aiScore}/10.` : ''} Nada foi postado ainda.`
                : '⚠️ Salvo, mas sem texto. Clique em “Gerar texto de novo” antes de postar.'}
          </div>
          <div style={{ background: '#fff', color: '#111', borderRadius: 10, padding: 8 }}>
            <OfferEditor offer={offer} onChange={setOffer} onPosted={() => setPosted(true)} onDeleted={() => setOffer(null)} sticky={false} />
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ m, onAnalyze }: { m: Message | (Converted & { id?: undefined; image?: false; text: string; at?: number }); onAnalyze: (url: string, coupon: string) => void }) {
  const [wa, setWa] = useState(m.whatsapp)
  const [tg, setTg] = useState(m.telegram)
  const [toWa, setToWa] = useState(true)
  const [toTg, setToTg] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const ours = m.links.filter(l => l.short)
  const foreign = m.links.filter(l => !l.short)

  async function send() {
    if (!confirm(`Enviar para ${[toWa && 'o grupo Achadinhos', toTg && 'o canal do Telegram'].filter(Boolean).join(' e ')}?`)) return
    setState('sending')
    setMsg('')
    try {
      const res = await fetch('/api/admin/sources/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, whatsapp: toWa ? wa : null, telegram: toTg ? tg : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setMsg(`Telegram: ${data.telegram === null ? '—' : data.telegram ? 'ok' : 'falhou'} · WhatsApp: ${data.whatsapp === null ? '—' : data.whatsapp ? 'ok' : 'falhou'}`)
      setState(data.telegram === false || data.whatsapp === false ? 'error' : 'sent')
    } catch (err: any) {
      setMsg(err.message)
      setState('error')
    }
  }

  return (
    <div style={{ ...box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>{m.text.split('\n')[0].replace(/[*_~]/g, '').slice(0, 90)}</b>
        {m.at && <span style={{ color: '#888', fontSize: 12 }}>{timeAgo(m.at)}</span>}
      </div>

      {m.coupons.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#aaa' }}>Cupom:</span>
          {m.coupons.map(c => (
            <span key={c} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <code style={{ background: '#FFE600', color: '#111', fontWeight: 900, padding: '4px 10px', borderRadius: 6, fontSize: 15 }}>{c}</code>
              <CopyButton value={c} label="Copiar" />
            </span>
          ))}
        </div>
      )}

      {ours.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#aaa' }}>Nossos links ({ours.length}):</span>
          {ours.map(l => (
            <div key={l.original} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <CopyButton value={l.short!} label="Copiar" />
              {/-\d{5,}\.html/.test(l.original) && (
                <button onClick={() => onAnalyze(l.original, m.coupons[0] || '')} style={{ ...btn, padding: '6px 10px', fontSize: 12, background: '#FFE600', color: '#111' }}>
                  Analisar
                </button>
              )}
              <code style={{ fontSize: 12, color: '#FFE600' }}>{l.short!.replace(/^https:\/\/(www\.)?/, '')}</code>
              <a href={l.original} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {l.original.replace(/^https?:\/\/(www\.)?/, '')} ↗
              </a>
            </div>
          ))}
        </div>
      )}
      {foreign.length > 0 && (
        <div style={{ fontSize: 12, color: '#f59e0b' }}>
          ⚠️ {foreign.length} link(s) de loja sem afiliado nosso ficaram como estão: {foreign.map(l => l.original.replace(/^https?:\/\//, '').slice(0, 40)).join(', ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: m.image ? 'minmax(0,140px) 1fr 1fr' : '1fr 1fr', gap: 10 }} className="nike-grid">
        {m.image && m.id && (
          <img src={`/api/admin/sources/${m.id}/image`} alt="" style={{ width: '100%', borderRadius: 8, background: '#000' }} />
        )}
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#aaa' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><input type="checkbox" checked={toWa} onChange={e => setToWa(e.target.checked)} /> WhatsApp (Achadinhos)</span>
            <CopyButton value={wa} label="Copiar texto" />
          </span>
          <textarea value={wa} onChange={e => setWa(e.target.value)} style={area} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#aaa' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><input type="checkbox" checked={toTg} onChange={e => setToTg(e.target.checked)} /> Telegram (HTML)</span>
          </span>
          <textarea value={tg} onChange={e => setTg(e.target.value)} style={area} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={send}
          disabled={state === 'sending' || state === 'sent' || (!toWa && !toTg) || ours.length === 0}
          style={{ ...btn, background: state === 'sent' ? '#16a34a' : '#25D366', color: '#fff', opacity: ours.length === 0 ? 0.5 : 1 }}
        >
          {state === 'sending' ? 'Enviando… (fila do WhatsApp, até 40s)' : state === 'sent' ? 'Enviado ✓' : 'Enviar'}
        </button>
        {ours.length === 0 && <span style={{ fontSize: 12, color: '#888' }}>sem link da Nike para trocar</span>}
        {msg && <span style={{ fontSize: 12, color: state === 'error' ? '#f87171' : '#9ca3af' }}>{msg}</span>}
      </div>
    </div>
  )
}

export default function NikePage() {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [error, setError] = useState('')
  const [pasted, setPasted] = useState('')
  const [converted, setConverted] = useState<(Converted & { text: string; key: number }) | null>(null)
  const [converting, setConverting] = useState(false)
  const [analyzeReq, setAnalyzeReq] = useState<AnalyzeRequest | null>(null)
  const onAnalyze = (url: string, coupon: string) => setAnalyzeReq({ url, coupon, key: Date.now() })

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/admin/sources', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setMessages(data.messages)
    } catch (err: any) {
      setError(err.message)
      setMessages([])
    }
  }
  useEffect(() => { load() }, [])

  async function convert() {
    setConverting(true)
    try {
      const res = await fetch('/api/admin/sources/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pasted }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setConverted({ ...data, text: pasted, key: Date.now() })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setConverting(false)
    }
  }

  return (
    <div style={{ padding: 24, color: '#eee', background: '#141417', minHeight: 'calc(100vh - 52px)' }}><div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@media (max-width: 760px) { .nike-grid { grid-template-columns: minmax(0,1fr) !important; } .nike-grid img { max-width: 220px; } }`}</style>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Grupo da Nike</h1>
      <p style={{ color: '#999', marginBottom: 20, fontSize: 14 }}>
        Mensagens do grupo de avisos (últimos 3 dias) com os links trocados pelos nossos e o cupom em destaque.
        Revise o texto e envie, ou só copie o link e o cupom.
      </p>

      <AnalyzeForm request={analyzeReq} />

      <div style={{ ...box, marginBottom: 24 }}>
        <b style={{ fontSize: 14 }}>Colar uma mensagem</b>
        <textarea
          value={pasted}
          onChange={e => setPasted(e.target.value)}
          placeholder="Cole aqui o texto de uma mensagem (com os links da nike.com.br)"
          style={{ ...area, minHeight: 90, marginTop: 8 }}
        />
        <button onClick={convert} disabled={!pasted.trim() || converting} style={{ ...btn, background: '#FFE600', color: '#111', marginTop: 8 }}>
          {converting ? 'Convertendo…' : 'Trocar links'}
        </button>
        {converted && <div style={{ marginTop: 14 }}><Card key={converted.key} m={converted} onAnalyze={onAnalyze} /></div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>Mensagens recebidas</h2>
        <button onClick={() => { setMessages(null); load() }} style={{ ...btn, background: '#333', color: '#fff', padding: '6px 10px', fontSize: 12 }}>Atualizar</button>
      </div>
      {error && <p style={{ color: '#f87171', marginBottom: 12 }}>{error}</p>}
      {messages === null && <p style={{ color: '#999' }}>Carregando…</p>}
      {messages?.length === 0 && !error && (
        <p style={{ color: '#999' }}>Nenhuma mensagem guardada ainda. As novas do grupo aparecem aqui assim que chegam.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        {messages?.map(m => <Card key={m.id} m={m} onAnalyze={onAnalyze} />)}
      </div>
    </div></div>
  )
}
