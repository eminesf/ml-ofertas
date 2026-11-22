'use client'
import { usePathname } from 'next/navigation'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'

// Botão flutuante do canal — no mobile fica acima da área segura do iPhone
export default function TelegramFab() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Seguir o canal no Telegram"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
    >
      <TelegramIcon className="size-7" />
    </a>
  )
}
