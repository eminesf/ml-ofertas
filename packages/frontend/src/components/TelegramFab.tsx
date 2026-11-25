'use client'
import { usePathname } from 'next/navigation'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'
import WhatsAppIcon from './WhatsAppIcon'
import { openWhatsAppGroups } from './WhatsAppGroups'

// Botão flutuante do canal — no mobile fica acima da área segura do iPhone
export default function TelegramFab({ whatsappUrl }: { whatsappUrl?: string | null }) {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null
  const className = `fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-14 cursor-pointer items-center justify-center rounded-full ${whatsappUrl ? 'bg-[#25D366]' : 'bg-[#229ED9]'} text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6`
  // WhatsApp: abre o modal de escolha de grupo (Tech & TCG / Achadinhos)
  if (whatsappUrl) {
    return (
      <button type="button" onClick={() => openWhatsAppGroups(whatsappUrl)} aria-label="Entrar nos grupos de promoções no WhatsApp" className={className}>
        <WhatsAppIcon className="size-7" />
      </button>
    )
  }
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={whatsappUrl ? 'Entrar no grupo de promoções no WhatsApp' : 'Seguir o canal no Telegram'}
      className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full ${whatsappUrl ? 'bg-[#25D366]' : 'bg-[#229ED9]'} text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6`}
    >
      {whatsappUrl ? <WhatsAppIcon className="size-7" /> : <TelegramIcon className="size-7" />}
    </a>
  )
}
