'use client'
import { useCallback, useEffect, useState } from 'react'

interface Status {
  conectado: boolean
  conectando: boolean
  qrImage: string | null
  habilitado: boolean
}

interface Group {
  id: string
  subject: string
  participants: number
}

const POLL_MS = 3000

export default function WhatsAppModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    try {
      await fetch('/api/admin/whatsapp/connect', { method: 'POST' })
    } catch {
      setError('Erro ao conectar com o servidor')
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/status', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro desconhecido')
        return
      }
      setError(null)
      setStatus(data)
    } catch {
      setError('Erro ao conectar com o servidor')
    }
  }, [])

  useEffect(() => {
    connect().then(refresh)
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [connect, refresh])

  const conectado = status?.conectado ?? false
  useEffect(() => {
    if (!conectado) return
    fetch('/api/admin/whatsapp/groups', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setGroups(data.groups ?? []))
      .catch(() => setGroups([]))
  }, [conectado])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const expirado = status !== null && !status.conectado && !status.conectando && !status.qrImage

  async function gerarNovoQr() {
    setStatus(null)
    await connect()
    await refresh()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar WhatsApp"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 400,
          maxHeight: '90vh', overflowY: 'auto', textAlign: 'center', boxSizing: 'border-box',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 900 }}>Conectar WhatsApp</h2>

        {error && <p style={{ margin: '12px 0', fontSize: 13, color: '#c53030', fontWeight: 600 }}>❌ {error}</p>}

        {!error && !status && <p style={{ margin: '24px 0', fontSize: 13, color: '#888' }}>Iniciando conexão...</p>}

        {status && !status.conectado && status.qrImage && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>
              No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho. O código atualiza sozinho.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={status.qrImage} alt="QR code do WhatsApp" width={280} height={280} style={{ maxWidth: '100%', height: 'auto' }} />
          </>
        )}

        {status && !status.conectado && !status.qrImage && status.conectando && (
          <p style={{ margin: '24px 0', fontSize: 13, color: '#888' }}>Conectando ao WhatsApp...</p>
        )}

        {expirado && (
          <>
            <p style={{ margin: '16px 0', fontSize: 13, color: '#888' }}>O QR expirou sem ser escaneado.</p>
            <button
              onClick={gerarNovoQr}
              style={{
                background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Gerar novo QR
            </button>
          </>
        )}

        {status?.conectado && (
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: '12px 0', fontSize: 13, color: '#276749', fontWeight: 700, textAlign: 'center' }}>
              ✅ WhatsApp conectado{status.habilitado ? ' — envio ligado' : ''}
            </p>
            {!status.habilitado && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>
                Para ligar o envio, coloque no <code>.env</code> o ID do grupo em <code>WHATSAPP_GROUP_JID</code>, defina <code>WHATSAPP_ENABLED=true</code> e reinicie o backend.
              </p>
            )}
            {groups === null && <p style={{ fontSize: 12, color: '#888' }}>Carregando grupos...</p>}
            {groups?.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>Nenhum grupo encontrado neste número.</p>}
            {groups?.map(g => (
              <div key={g.id} style={{ padding: '8px 0', borderTop: '1px solid #eee' }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700 }}>
                  {g.subject} <span style={{ fontWeight: 400, color: '#888' }}>({g.participants})</span>
                </p>
                <code style={{ fontSize: 11, userSelect: 'all', wordBreak: 'break-all' }}>{g.id}</code>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            display: 'block', margin: '16px auto 0', background: 'none', border: 'none',
            color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
