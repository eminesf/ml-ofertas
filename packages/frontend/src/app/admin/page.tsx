'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import WhatsAppModal from '@/components/WhatsAppModal'

interface JobStatus {
  loading: boolean
  result: string | null
  error: string | null
}

const JOBS = [
  {
    id: 'post',
    label: 'Postar Pendentes',
    description: 'Posta as melhores ofertas aprovadas pela IA que ainda não foram publicadas.',
    icon: '📤',
  },
  {
    id: 'repost',
    label: 'Repostar',
    description: 'Repost de ofertas já postadas (máx 2x/dia por oferta, intervalo de 4h).',
    icon: '🔄',
  },
]

export default function AdminDashboard() {
  const [whatsAppOpen, setWhatsAppOpen] = useState(false)
  // Confirmação antes de disparar (evita clique sem querer) e andamento do repost (cancelável)
  const [confirmJob, setConfirmJob] = useState<(typeof JOBS)[number] | null>(null)
  const [repost, setRepost] = useState<{ running: boolean; cancel: boolean; done: number; total: number } | null>(null)

  useEffect(() => {
    let stop = false
    async function poll() {
      try {
        const res = await fetch('/api/admin/repost/status', { cache: 'no-store' })
        if (res.ok && !stop) setRepost(await res.json())
      } catch {}
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  async function cancelRepost() {
    const res = await fetch('/api/admin/repost/cancel', { method: 'POST' })
    if (res.ok) setRepost(await res.json())
  }
  const [statuses, setStatuses] = useState<Record<string, JobStatus>>(
    Object.fromEntries(JOBS.map(j => [j.id, { loading: false, result: null, error: null }]))
  )

  async function triggerJob(jobId: string) {
    setStatuses(prev => ({ ...prev, [jobId]: { loading: true, result: null, error: null } }))
    try {
      const res = await fetch(`/api/admin/job/${jobId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setStatuses(prev => ({ ...prev, [jobId]: { loading: false, result: null, error: data.error || 'Erro desconhecido' } }))
        return
      }
      setStatuses(prev => ({ ...prev, [jobId]: { loading: false, result: `Job "${data.job}" iniciado em background.`, error: null } }))
    } catch {
      setStatuses(prev => ({ ...prev, [jobId]: { loading: false, result: null, error: 'Erro ao conectar com o servidor' } }))
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '2.5rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 900 }}>Dashboard</h1>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
          Controle manual de posting. Scraping roda 100% local: <code>npm run scrape</code> (ou <code>scrape:ml</code> / <code>scrape:hub</code> / <code>scrape:amazon</code>).
        </p>
      </div>

      {/* Ação rápida */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '1rem 1.1rem',
        border: '1px solid #e5e5e5', marginBottom: '1.5rem',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14 }}>📥 Importar oferta manualmente</p>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            Cole uma URL (ML, Amazon, Shopee, KaBuM!, AliExpress, Stanley) para scraping, IA e posting imediato.
          </p>
        </div>
        <Link
          href="/admin/import"
          style={{
            background: '#FFE600', color: '#333', textDecoration: 'none',
            fontWeight: 800, fontSize: 13, borderRadius: 8, padding: '8px 16px',
            whiteSpace: 'nowrap',
          }}
        >
          Abrir →
        </Link>
      </div>

      {/* WhatsApp */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '1rem 1.1rem',
        border: '1px solid #e5e5e5', marginBottom: '1.5rem',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14 }}>💬 WhatsApp</p>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            Mostra o QR code para parear o número e lista os grupos.
          </p>
        </div>
        <button
          onClick={() => setWhatsAppOpen(true)}
          style={{
            background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          Conectar WhatsApp
        </button>
      </div>
      {whatsAppOpen && <WhatsAppModal onClose={() => setWhatsAppOpen(false)} />}

      {/* Jobs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {JOBS.map(job => {
          const status = statuses[job.id]
          return (
            <div
              key={job.id}
              style={{
                background: '#fff', borderRadius: 14, padding: '1rem 1.1rem',
                border: '1px solid #e5e5e5',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>{job.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14 }}>{job.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{job.description}</p>
                {status.result && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#276749', fontWeight: 600 }}>
                    ✅ {status.result}
                  </p>
                )}
                {status.error && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#c53030', fontWeight: 600 }}>
                    ❌ {status.error}
                  </p>
                )}
              </div>
              {job.id === 'repost' && repost?.running && (
                <button
                  onClick={cancelRepost}
                  disabled={repost.cancel}
                  style={{
                    background: repost.cancel ? '#ccc' : '#c53030', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: repost.cancel ? 'default' : 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  {repost.cancel ? 'Cancelando…' : `Cancelar (${repost.done}/${repost.total || '?'})`}
                </button>
              )}
              <button
                onClick={() => setConfirmJob(job)}
                disabled={status.loading || (job.id === 'repost' && !!repost?.running)}
                style={{
                  background: status.loading ? '#ccc' : '#1a1a2e',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '8px 16px', fontWeight: 700, fontSize: 13,
                  cursor: status.loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                {status.loading ? 'Iniciando...' : 'Disparar'}
              </button>
            </div>
          )
        })}
      </div>

      {confirmJob && (
        <div
          onClick={() => setConfirmJob(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16 }}>{confirmJob.icon} {confirmJob.label}?</p>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#666' }}>
              {confirmJob.description} Isso posta nos grupos do WhatsApp e no Telegram agora.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmJob(null)}
                style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { const id = confirmJob.id; setConfirmJob(null); triggerJob(id) }}
                style={{ background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Sim, disparar
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: '1.5rem', fontSize: 12, color: '#aaa', textAlign: 'center' }}>
        Os jobs rodam em background — acompanhe o resultado pelo log do backend (pm2).
      </p>
    </main>
  )
}
