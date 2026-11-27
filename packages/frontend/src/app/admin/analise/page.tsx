'use client'
import { useEffect, useState } from 'react'

// Painel de análise: cliques nos links curtos (por dia, origem e loja), posts por canal,
// funil por loja (encontradas → aprovadas → postadas), top ofertas e relatório da Awin.

interface Analytics {
  groupJoins?: { group: string; origin: string; originLabel: string; clicks: number }[]
  days: number
  totals: { clicks: number; offersPosted: number; clicksEver: number }
  daily: { day: string; clicks: number; posts: number }[]
  bySrc: { key: string; label: string; clicks: number; posts: number | null; perPost: number | null }[]
  byProvider: { provider: string; label: string; clicks: number }[]
  posts: { channel: string; label: string; count: number }[]
  funnel: { provider: string; label: string; found: number; approved: number; posted: number }[]
  top: { clicks: number; offer: { id: string; title: string; provider: string; salePrice: number; discountPct: number; imageUrl: string | null } }[]
  awin:
    | { configured: false }
    | { error: string }
    | { configured: true; advertisers: { name: string; clicks: number; sales: number; saleValue: number; commission: number; pendingCommission: number; confirmedCommission: number }[] }
}

const INK = '#111'
const MUTED = '#777'
const BAR = '#2563eb' // uma cor só: magnitude, não identidade
const BAR_TRACK = '#eef2ff'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>{title}</h2>
      {hint && <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>{hint}</p>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, padding: '0.9rem 1.1rem', flex: '1 1 160px' }}>
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: INK, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED }}>{sub}</div>}
    </div>
  )
}

// Colunas por dia (uma série): valor no hover e o maior valor rotulado
function DailyBars({ data, field, unit }: { data: Analytics['daily']; field: 'clicks' | 'posts'; unit: string }) {
  const max = Math.max(1, ...data.map(d => d[field]))
  const peak = data.reduce((best, d) => (d[field] > best[field] ? d : best), data[0])
  const showEvery = data.length > 14 ? Math.ceil(data.length / 10) : 1
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, borderBottom: '1px solid #ddd' }}>
        {data.map(d => {
          const h = (d[field] / max) * 100
          return (
            <div key={d.day} title={`${shortDay(d.day)}: ${d[field]} ${unit}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', cursor: 'default' }}>
              {d === peak && d[field] > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 2 }}>{d[field]}</span>}
              <div style={{ width: '100%', maxWidth: 28, height: `${h}%`, minHeight: d[field] ? 2 : 0, background: BAR, borderRadius: '4px 4px 0 0' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={d.day} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: MUTED }}>{i % showEvery === 0 ? shortDay(d.day) : ''}</div>
        ))}
      </div>
    </div>
  )
}

// Barras horizontais com rótulo e valor (ranking)
function HBars({ rows }: { rows: { label: string; value: number; extra?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  if (!rows.length) return <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Sem dados no período.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.label} title={`${r.label}: ${r.value}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
            <span style={{ color: INK, fontWeight: 600 }}>{r.label}</span>
            <span style={{ color: INK, fontWeight: 700 }}>
              {r.value.toLocaleString('pt-BR')}
              {r.extra && <span style={{ color: MUTED, fontWeight: 500 }}> · {r.extra}</span>}
            </span>
          </div>
          <div style={{ height: 8, background: BAR_TRACK, borderRadius: 4 }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: BAR, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: MUTED, fontWeight: 700, padding: '6px 8px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontSize: 13, color: INK, padding: '7px 8px', borderBottom: '1px solid #f3f3f3', whiteSpace: 'nowrap' }
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function AnalisePage() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/admin/analytics?days=${days}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `Erro ${r.status}`)
        if (!cancelled) setData(d)
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [days])

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, flex: 1 }}>Análise</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid ' + (days === d ? INK : '#ccc'), background: days === d ? INK : '#fff', color: days === d ? '#fff' : INK,
              }}
            >
              {d === 1 ? 'Hoje' : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: '#c00' }}>{error}</p>}
      {!data && !error && <p>Carregando…</p>}

      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .15s' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Stat label="Cliques nos links" value={data.totals.clicks.toLocaleString('pt-BR')} sub={`no período · ${data.totals.clicksEver.toLocaleString('pt-BR')} desde o início`} />
            <Stat label="Ofertas postadas" value={data.totals.offersPosted.toLocaleString('pt-BR')} sub="ofertas novas (sem repost)" />
            <Stat
              label="Cliques por oferta"
              value={data.totals.offersPosted ? (data.totals.clicks / data.totals.offersPosted).toFixed(1).replace('.', ',') : '—'}
              sub="média no período"
            />
            {'configured' in data.awin && data.awin.configured && (
              <Stat
                label="Comissão Awin"
                value={brl(data.awin.advertisers.reduce((s, a) => s + a.commission, 0))}
                sub={`${brl(data.awin.advertisers.reduce((s, a) => s + a.confirmedCommission, 0))} confirmada`}
              />
            )}
          </div>

          <Card title="Cliques por dia" hint="Cliques nos links curtos /r/ (robôs de prévia não contam). Passe o mouse na barra para ver o valor.">
            {data.totals.clicks === 0
              ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Ainda sem cliques registrados no período — a contagem por dia e por origem começou em 25/11/2026.</p>
              : <DailyBars data={data.daily} field="clicks" unit="cliques" />}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
            <Card title="Cliques por origem" hint="De onde a pessoa clicou · cliques por post do canal">
              <HBars rows={data.bySrc.map(s => ({ label: s.label, value: s.clicks, extra: s.perPost != null ? `${s.perPost.toFixed(1).replace('.', ',')}/post` : undefined }))} />
            </Card>
            <Card title="Cliques por loja">
              <HBars rows={data.byProvider.map(p => ({ label: p.label, value: p.clicks }))} />
            </Card>
          </div>

          <Card title="Cliques em “Entrar no grupo”" hint="Botões das landing pages (/grupo/tech, /grupo/achadinhos, /whatsapp) e da /links. “anúncio” = veio com utm/fbclid. Conta o clique no botão; quem entrou de fato só o WhatsApp sabe.">
            {!data.groupJoins?.length
              ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Ainda sem cliques nos botões de entrar (contagem começou em 26/11/2026).</p>
              : <HBars rows={data.groupJoins.map(j => ({ label: `${j.group === 'tech' ? 'Tech & TCG' : 'Achadinhos'} · ${j.originLabel}`, value: j.clicks }))} />}
          </Card>

          <Card title="Ofertas postadas por dia" hint="Ofertas novas que saíram (a mesma oferta no Telegram e no WhatsApp conta 1).">
            <DailyBars data={data.daily} field="posts" unit="ofertas" />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
            <Card title="Posts por canal" hint="Mensagens enviadas no período, incluindo reposts">
              <HBars rows={data.posts.map(p => ({ label: p.label, value: p.count })).sort((a, b) => b.value - a.value)} />
            </Card>
            <Card title="Funil por loja" hint="Ofertas que entraram no período">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={th}>Loja</th><th style={{ ...th, textAlign: 'right' }}>Encontradas</th><th style={{ ...th, textAlign: 'right' }}>Aprovadas IA</th><th style={{ ...th, textAlign: 'right' }}>Postadas</th></tr>
                  </thead>
                  <tbody>
                    {data.funnel.map(f => (
                      <tr key={f.provider}>
                        <td style={td}>{f.label}</td>
                        <td style={num}>{f.found}</td>
                        <td style={num}>{f.approved}</td>
                        <td style={num}>{f.posted} <span style={{ color: MUTED, fontSize: 11 }}>({f.approved ? Math.round((f.posted / f.approved) * 100) : 0}%)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card title="Ofertas mais clicadas" hint="No período">
            {data.top.length === 0
              ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Sem cliques registrados no período.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.top.map((t, i) => (
                    <a key={t.offer.id} href={`/oferta/${t.offer.id}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: INK }}>
                      <span style={{ width: 20, fontSize: 12, color: MUTED, fontWeight: 700 }}>{i + 1}</span>
                      {t.offer.imageUrl ? <img src={t.offer.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : <span style={{ width: 36 }} />}
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.offer.title}</span>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{t.clicks} cliques</span>
                    </a>
                  ))}
                </div>
              )}
          </Card>

          <Card title="Awin (Nike, KaBuM!, Stanley, AliExpress)" hint="Cliques, vendas e comissão segundo a própria Awin">
            {'error' in data.awin && <p style={{ fontSize: 13, color: '#c00', margin: 0 }}>Erro ao consultar a Awin: {data.awin.error}</p>}
            {'configured' in data.awin && !data.awin.configured && (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                Não configurado. Na Awin, abra o menu do seu usuário → <b>API Credentials</b>, gere o token e coloque no <code>.env</code> como{' '}
                <code>AWIN_API_TOKEN=…</code> (depois reinicie o backend).
              </p>
            )}
            {'configured' in data.awin && data.awin.configured && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Anunciante</th><th style={{ ...th, textAlign: 'right' }}>Cliques</th><th style={{ ...th, textAlign: 'right' }}>Vendas</th>
                      <th style={{ ...th, textAlign: 'right' }}>Valor vendido</th><th style={{ ...th, textAlign: 'right' }}>Comissão</th><th style={{ ...th, textAlign: 'right' }}>Confirmada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.awin.advertisers.map(a => (
                      <tr key={a.name}>
                        <td style={td}>{a.name}</td><td style={num}>{a.clicks}</td><td style={num}>{a.sales}</td>
                        <td style={num}>{brl(a.saleValue)}</td><td style={num}>{brl(a.commission)}</td><td style={num}>{brl(a.confirmedCommission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </main>
  )
}
