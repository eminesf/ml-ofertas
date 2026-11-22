'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame } from 'lucide-react'
import SearchBar from './SearchBar'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'
import WhatsAppIcon, { WHATSAPP_GREEN } from './WhatsAppIcon'
import { Button } from '@/components/ui/button'
import { CATEGORIES, cn } from '@/lib/utils'

export default function SiteHeader({ whatsappUrl }: { whatsappUrl?: string | null }) {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="h-1 bg-brand" />
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fox Ofertas — início">
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-brand shadow-sm">
            <img src="/logo_png.png" alt="" className="size-9 object-contain" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight">Fox Ofertas</span>
            <span className="block text-[11px] font-medium text-muted-foreground">Promoção boa todo dia</span>
          </span>
        </Link>

        <div className="hidden flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {whatsappUrl && (
            <Button asChild size="sm" className={cn('h-9 rounded-full px-3.5 font-semibold shadow-sm sm:px-4', WHATSAPP_GREEN)}>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-4" />
                <span className="hidden sm:inline">Promos no WhatsApp</span>
                <span className="sm:hidden">Entrar</span>
              </a>
            </Button>
          )}
          <Button
            asChild
            size="sm"
            variant="outline"
            className={cn('h-9 rounded-full text-[#229ED9]', whatsappUrl ? 'w-9 px-0' : 'px-3.5')}
          >
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Canal no Telegram" title="Canal no Telegram">
              <TelegramIcon className="size-4" />
              {!whatsappUrl && <span className="text-foreground">Telegram</span>}
            </a>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-2.5 md:hidden">
        <SearchBar />
      </div>

      <nav aria-label="Categorias" className="mx-auto max-w-6xl">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2.5">
          <NavChip href="/" active={pathname === '/'}>
            <Flame className="size-3.5" /> Todas
          </NavChip>
          {CATEGORIES.map(c => (
            <NavChip key={c.slug} href={`/categoria/${c.slug}`} active={pathname === `/categoria/${c.slug}`}>
              {c.short}
            </NavChip>
          ))}
        </div>
      </nav>
    </header>
  )
}

function NavChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
        active
          ? 'border-transparent bg-foreground text-background'
          : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
