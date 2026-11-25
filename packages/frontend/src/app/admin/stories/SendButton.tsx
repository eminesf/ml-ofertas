'use client'
import { useState } from 'react'

// Posta a oferta agora no Telegram e no grupo do WhatsApp dela (mesmo proxy da /admin/fila)
export default function SendButton({ id, alreadyPosted }: { id: string; alreadyPosted: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(alreadyPosted ? 'sent' : 'idle')
  const [error, setError] = useState('')

  async function send() {
    setState('sending')
    setError('')
    try {
      const res = await fetch(`/api/admin/send/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setState('sent')
    } catch (err: any) {
      setError(err.message)
      setState('error')
    }
  }

  return (
    <>
      <button
        onClick={send}
        disabled={state === 'sending' || state === 'sent'}
        style={{
          flex: 1, textAlign: 'center', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 800,
          fontFamily: 'inherit', cursor: state === 'sending' || state === 'sent' ? 'default' : 'pointer',
          background: state === 'sent' ? '#16a34a' : '#25D366', color: '#fff',
        }}
      >
        {state === 'sending' ? 'Enviando…' : state === 'sent' ? (alreadyPosted ? 'Já postada ✓' : 'Enviada ✓') : 'Enviar p/ grupos'}
      </button>
      {error && <div style={{ width: '100%', fontSize: 11, color: '#f87171' }}>{error}</div>}
    </>
  )
}
