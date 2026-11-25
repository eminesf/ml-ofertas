'use client'
import { useCallback, useEffect, useState } from 'react'

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

interface Full extends Omit<Row, 'hasCopy' | 'posts'> {
  category: string | null
  telegramMessage: string | null
  whatsappMessage: string | null
  posts: { channel: string; sentAt: string; price: number | null; couponCode: string | null }[]
}

type Busy = '' | 'save' | 'regen' | 'send' | 'repost' | 'delete'

const CHANNEL: Record<string, string> = { telegram: 'Telegram', whatsapp: 'Tech & TCG', 'whatsapp-achadinhos': 'Achadinhos' }
const GROUP: Record<string, string> = { tech: 'Tech & TCG', achadinhos: 'Achadinhos' }
const SITE = 'https://www.foxpromocoes.com.br'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const box: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '1px solid #e5e5e5', padding: 14 }
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#555', margin: '10px 0 4px' }
const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ background: bg, color, border: 'none', borderRadius: 6, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/admin/offers${path}`, { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
  return data
}

export default function OfertasPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<Full | null>(null)

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

        {sel && <Editor key={sel.id} offer={sel} onChange={setSel} onDeleted={() => { setSel(null); search(q) }} />}
      </div>
    </div>
  )
}

function Editor({ offer, onChange, onDeleted }: { offer: Full; onChange: (o: Full) => void; onDeleted: () => void }) {
  const [f, setF] = useState({
    title: offer.title,
    productUrl: offer.productUrl,
    imageUrl: offer.imageUrl || '',
    salePrice: String(offer.salePrice),
    originalPrice: String(offer.originalPrice),
    couponCode: offer.couponCode || '',
    telegramMessage: offer.telegramMessage || '',
    whatsappMessage: offer.whatsappMessage || '',
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<Busy>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  const dirty = JSON.stringify(f) !== JSON.stringify({
    title: offer.title, productUrl: offer.productUrl, imageUrl: offer.imageUrl || '', salePrice: String(offer.salePrice),
    originalPrice: String(offer.originalPrice), couponCode: offer.couponCode || '', telegramMessage: offer.telegramMessage || '', whatsappMessage: offer.whatsappMessage || '',
  })

  async function run(kind: Busy, fn: () => Promise<string>) {
    setBusy(kind)
    setMsg(null)
    try {
      setMsg({ ok: true, text: await fn() })
    } catch (err: any) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy('')
    }
  }

  async function reload() {
    const data = await api(`/${offer.id}`)
    onChange(data.offer)
    return data.offer as Full
  }

  const save = () => run('save', async () => {
    await api(`/${offer.id}`, { method: 'PATCH', body: JSON.stringify(f) })
    await reload()
    return 'Salvo.'
  })

  const regen = () => run('regen', async () => {
    if (dirty) await api(`/${offer.id}`, { method: 'PATCH', body: JSON.stringify(f) })
    await api(`/${offer.id}/regenerate`, { method: 'POST', body: JSON.stringify({ note }) })
    const o = await reload()
    setF(s => ({ ...s, telegramMessage: o.telegramMessage || '', whatsappMessage: o.whatsappMessage || '' }))
    return 'Texto novo gerado — confira antes de postar.'
  })

  const send = (repost: boolean) => run(repost ? 'repost' : 'send', async () => {
    if (dirty) await api(`/${offer.id}`, { method: 'PATCH', body: JSON.stringify(f) })
    const r = await api(`/${offer.id}/send${repost ? '?repost=1' : ''}`, { method: 'POST' })
    await reload()
    return `Postada — Telegram: ${r.telegram ? 'ok' : 'não'}, WhatsApp: ${r.whatsapp ? 'ok' : 'não'}`
  })

  const del = () => run('delete', async () => {
    await api(`/${offer.id}`, { method: 'DELETE' })
    onDeleted()
    return 'Apagada.'
  })

  const posted = offer.posts.length > 0
  const link = offer.shortCode ? `${SITE}/r/${offer.shortCode}` : null

  return (
    <div style={{ ...box, position: 'sticky', top: 10 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {f.imageUrl && <img src={f.imageUrl} alt="" style={{ width: 90, height: 90, objectFit: 'contain', borderRadius: 8, background: '#fafafa', flexShrink: 0 }} />}
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, minWidth: 0 }}>
          <div><b>{offer.externalId}</b> · {offer.provider} · {offer.source} · IA {offer.aiScore ?? '–'}/10</div>
          <div>Grupo: <b>{GROUP[offer.group] || offer.group}</b> · {offer.clicks} cliques</div>
          {link && <div style={{ overflowWrap: 'anywhere' }}>Link curto: <a href={link} target="_blank" rel="noreferrer">{link.replace('https://www.', '')}</a></div>}
          <div><a href={`/oferta/${offer.id}`} target="_blank" rel="noreferrer">Página no site</a> · <a href={f.productUrl} target="_blank" rel="noreferrer">Abrir na loja</a></div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
        {posted
          ? <>Postada: {offer.posts.map((p, i) => <span key={i}>{i > 0 && ' · '}{CHANNEL[p.channel] || p.channel} {when(p.sentAt)}</span>)}</>
          : offer.telegramMessage ? (offer.fresh ? 'Na fila, ainda não postada.' : 'Fora do prazo da fila — só sai se você postar.') : 'Sem texto: gere o texto para poder postar.'}
      </div>

      <label style={label}>Título</label>
      <input value={f.title} onChange={set('title')} style={input} />

      <label style={label}>Link do produto (para trocar a cor, cole o link com o <code>?cor=</code> novo)</label>
      <input value={f.productUrl} onChange={set('productUrl')} style={input} />

      <label style={label}>Foto (URL)</label>
      <input value={f.imageUrl} onChange={set('imageUrl')} style={input} />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Preço (R$)</label>
          <input value={f.salePrice} onChange={set('salePrice')} inputMode="decimal" style={input} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Preço “de” (R$)</label>
          <input value={f.originalPrice} onChange={set('originalPrice')} inputMode="decimal" style={input} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Cupom</label>
          <input value={f.couponCode} onChange={set('couponCode')} style={input} />
        </div>
      </div>

      <label style={label}>Texto do Telegram</label>
      <textarea value={f.telegramMessage} onChange={set('telegramMessage')} rows={7} style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
      <label style={label}>Texto do WhatsApp</label>
      <textarea value={f.whatsappMessage} onChange={set('whatsappMessage')} rows={5} style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />

      <label style={label}>Instrução para a IA ao gerar o texto de novo (opcional)</label>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder='ex.: no Pix sai por R$ 329,98; cor branca' style={input} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <button onClick={save} disabled={!!busy || !dirty} style={{ ...btn('#1a1a2e'), opacity: !dirty ? 0.5 : 1 }}>{busy === 'save' ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={regen} disabled={!!busy} style={btn('#6d28d9')}>{busy === 'regen' ? 'Gerando…' : 'Gerar texto de novo (IA)'}</button>
        {!posted && <button onClick={() => send(false)} disabled={!!busy || !f.telegramMessage} style={btn('#16a34a')}>{busy === 'send' ? 'Postando…' : 'Postar agora'}</button>}
        {posted && <button onClick={() => send(true)} disabled={!!busy || !f.telegramMessage} style={btn('#16a34a')}>{busy === 'repost' ? 'Postando…' : 'Postar de novo'}</button>}
        {!confirmDelete
          ? <button onClick={() => setConfirmDelete(true)} disabled={!!busy} style={btn('#fff', '#c00')}>Apagar</button>
          : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              Apagar a oferta e o histórico de posts? O link curto para de funcionar.
              <button onClick={del} disabled={!!busy} style={btn('#c00')}>{busy === 'delete' ? 'Apagando…' : 'Sim, apagar'}</button>
              <button onClick={() => setConfirmDelete(false)} style={btn('#eee', '#333')}>Cancelar</button>
            </span>}
      </div>
      {dirty && <p style={{ fontSize: 12, color: '#b45309', margin: '8px 0 0' }}>Alterações não salvas — “Postar” e “Gerar texto” salvam antes.</p>}
      {msg && <p style={{ fontSize: 13, margin: '8px 0 0', color: msg.ok ? '#15803d' : '#c00' }}>{msg.text}</p>}
    </div>
  )
}
