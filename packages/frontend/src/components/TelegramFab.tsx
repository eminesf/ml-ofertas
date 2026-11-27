'use client'
import { hideSiteChrome } from '@/lib/site'
import { usePathname } from 'next/navigation'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'
import WhatsAppIcon from './WhatsAppIcon'
import { openWhatsAppGroups } from './WhatsAppGroups'

// Botão flutuante do canal — no mobile fica acima da área segura do iPhone.
// --cookie-bar-h (CookieConsent): sobe acima da faixa de cookies enquanto ela está aberta.
export default function TelegramFab({ whatsappUrl }: { whatsappUrl?: string | null }) {
  const pathname = usePathname()
  if (hideSiteChrome(pathname)) return null
  // Página da oferta: no mobile tem a barra fixa de preço + "Ir para a loja" embaixo; o botão fica logo acima dela
  const onOffer = pathname.startsWith('/oferta/')
  const mobileBottom = onOffer
    ? 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5.25rem+var(--cookie-bar-h,0px))]'
    : 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+var(--cookie-bar-h,0px))]'
  const className = `fixed right-4 ${mobileBottom} z-40 flex size-14 cursor-pointer items-center justify-center rounded-full ${whatsappUrl ? 'bg-[#25D366]' : 'bg-[#229ED9]'} text-white shadow-lg shadow-black/20 transition-[bottom,transform] duration-300 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-[calc(1.5rem+var(--cookie-bar-h,0px))]`
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
      className={className}
    >
      {whatsappUrl ? <WhatsAppIcon className="size-7" /> : <TelegramIcon className="size-7" />}
    </a>
  )
}
