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
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#bcd6f5] bg-[#e8f2fd] shadow-[0_-4px_14px_rgba(30,64,120,0.10)]"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-4">
        <span aria-hidden className="hidden text-xl sm:block">🍪</span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-[#1e3a5f] sm:text-sm">
          Usamos cookies para medir visitas e melhorar nossos anúncios.{' '}
          <Link href="/privacidade" className="font-bold text-[#1d4ed8] underline underline-offset-2">
            Saiba mais
          </Link>
        </p>
        <button
          type="button"
          onClick={() => answer('no')}
          className="shrink-0 cursor-pointer rounded-lg border border-[#9fc2ec] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1e3a5f] hover:bg-[#f4f8fe] sm:px-4 sm:text-sm"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => answer('ok')}
          className="shrink-0 cursor-pointer rounded-lg bg-brand px-3.5 py-2 text-[13px] font-bold text-brand-foreground shadow-sm hover:brightness-95 sm:px-4 sm:text-sm"
        >
          Aceitar
        </button>
      </div>
    </div>
  )
}
