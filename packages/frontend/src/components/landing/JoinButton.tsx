'use client'
import { useEffect, useState } from 'react'
import WhatsAppIcon from '@/components/WhatsAppIcon'

// Botão "Entrar no grupo": passa por /entrar/<grupo>?o=<origem> (conta o clique) e dispara o
// evento Lead do pixel da Meta (o pixel só existe se a pessoa aceitou os cookies).
// Veio de anúncio (utm_* ou fbclid na URL) → a origem ganha "-ads" para separar na Análise.
export default function JoinButton({
  group,
  origin,
  label = 'Entrar no grupo grátis',
  size = 'lg',
  className = '',
}: {
  group: 'tech' | 'achadinhos'
  origin: string
  label?: string
  size?: 'lg' | 'md'
  className?: string
}) {
  const [o, setO] = useState(origin)
  useEffect(() => {
    if (/[?&](utm_[a-z]+|fbclid|gclid)=/i.test(location.search)) setO(`${origin}-ads`)
  }, [origin])

  return (
    <a
      href={`/entrar/${group}?o=${encodeURIComponent(o)}`}
      onClick={() => window.fbq?.('track', 'Lead', { content_name: group })}
      className={`flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] font-black text-[#0b2a16] shadow-[0_8px_28px_rgba(37,211,102,.35)] transition hover:-translate-y-0.5 hover:bg-[#2fe072] active:scale-[0.98] ${
        size === 'lg' ? 'px-5 py-4 text-[18px]' : 'px-4 py-3 text-[15px]'
      } ${className}`}
    >
      <WhatsAppIcon className={size === 'lg' ? 'size-6' : 'size-5'} />
      {label}
    </a>
  )
}
