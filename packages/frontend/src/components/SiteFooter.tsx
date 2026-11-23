'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/utils'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'
import WhatsAppIcon from './WhatsAppIcon'
import InstagramIcon, { INSTAGRAM_URL } from './InstagramIcon'

export default function SiteFooter({ whatsappUrl }: { whatsappUrl?: string | null }) {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null

  return (
    <footer className="mt-12 border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 pb-24 sm:grid-cols-[2fr_1fr_1fr] sm:pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-brand">
              <img src="/logo_png.png" alt="" className="size-8 object-contain" />
            </span>
            <span className="font-extrabold tracking-tight">Fox Promoções</span>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Garimpamos promoções o dia todo em várias lojas. Os preços podem mudar a
            qualquer momento — confira sempre no site da loja.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Categorias</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground sm:grid-cols-1">
            {CATEGORIES.map(c => (
              <li key={c.slug}>
                <Link href={`/categoria/${c.slug}`} className="hover:text-foreground">{c.short}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Receba primeiro</p>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground hover:text-[#1ebe5b]"
            >
              <WhatsAppIcon className="size-4 text-[#25D366]" /> Grupo de promoções no WhatsApp
            </a>
          )}
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <TelegramIcon className="size-4 text-[#229ED9]" /> @e_foxofertas
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <InstagramIcon className="size-4 text-[#E1306C]" /> @fox_promocoes_
          </a>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © 2026 Fox Promoções · Podemos receber comissão por compras feitas pelos links, sem custo extra para você.
        </p>
      </div>
    </footer>
  )
}
