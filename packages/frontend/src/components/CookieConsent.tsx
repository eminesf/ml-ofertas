'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getConsent, setConsent } from '@/lib/consent'

// Faixa fina no rodapé da tela (estilo barra de ações): não cobre o conteúdo nem bloqueia
// a navegação. Some depois de Aceitar/Recusar. Fora do /admin.
export default function CookieConsent() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(getConsent() === null)
  }, [])

  if (!open || pathname.startsWith('/admin')) return null

  function answer(v: 'ok' | 'no') {
    setConsent(v)
    setOpen(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] border-t bg-card/95 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          Usamos cookies para medir visitas e melhorar nossos anúncios.{' '}
          <Link href="/privacidade" className="font-semibold text-foreground underline underline-offset-2">
            Saiba mais
          </Link>
        </p>
        <button
          type="button"
          onClick={() => answer('no')}
          className="shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => answer('ok')}
          className="shrink-0 cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground hover:brightness-95"
        >
          Aceitar
        </button>
      </div>
    </div>
  )
}
