'use client'
import { useEffect, useState } from 'react'
import { getConsent, setConsent, type Consent } from '@/lib/consent'

// Botões da página de privacidade para mudar a escolha de cookies a qualquer momento
export default function CookieChoice() {
  const [consent, setState] = useState<Consent>(null)
  useEffect(() => setState(getConsent()), [])

  function choose(v: 'ok' | 'no') {
    setConsent(v)
    setState(v)
    // Recusar depois de aceitar: recarrega para o pixel já carregado sair da página
    if (v === 'no' && consent === 'ok') window.location.reload()
  }

  const status = consent === 'ok' ? 'Aceito' : consent === 'no' ? 'Recusado' : 'Sem resposta'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs text-muted-foreground">
        Situação atual: <b className="text-foreground">{status}</b>
      </span>
      <button type="button" onClick={() => choose('no')} className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
        Recusar
      </button>
      <button type="button" onClick={() => choose('ok')} className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground hover:brightness-95">
        Aceitar
      </button>
    </div>
  )
}
