'use client'

import { hideSiteChrome } from '@/lib/site'
import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame } from 'lucide-react'
import SearchBar from './SearchBar'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'
import WhatsAppIcon, { WHATSAPP_GREEN } from './WhatsAppIcon'
import { openWhatsAppGroups } from './WhatsAppGroups'
import { Button } from '@/components/ui/button'
import { CATEGORIES, cn } from '@/lib/utils'

export default function SiteHeader({ whatsappUrl }: { whatsappUrl?: string | null }) {
  const pathname = usePathname()
  if (hideSiteChrome(pathname)) return null

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="h-1 bg-brand" />
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fox Promoções — início">
          <img src="/logo-fox-sm.webp" alt="" width={60} height={54} className="h-12 w-auto object-contain drop-shadow-sm sm:h-14" />
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight">Fox Promoções</span>
            <span className="block text-[11px] font-medium text-muted-foreground">Promoção boa todo dia</span>
          </span>
        </Link>

        <div className="hidden flex-1 md:block">
          <Suspense fallback={<SearchFallback />}>
            <SearchBar />
          </Suspense>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {whatsappUrl && (
            <Button size="sm" onClick={() => openWhatsAppGroups(whatsappUrl)} className={cn('h-9 rounded-full px-3.5 font-semibold shadow-sm sm:px-4', WHATSAPP_GREEN)}>
              <WhatsAppIcon className="size-4" />
              <span className="hidden sm:inline">Promos no WhatsApp</span>
              <span className="sm:hidden">Entrar</span>
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
        <Suspense fallback={<SearchFallback />}>
          <SearchBar />
        </Suspense>
      </div>

      <nav aria-label="Categorias" className="mx-auto max-w-6xl">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2.5">
          <NavChip href="/" active={pathname === '/'}>
            <Flame className="size-3.5" /> Todas
          </NavChip>
          {CATEGORIES.map(c => (
            <NavChip key={c.slug} href={`/categoria/${c.slug}`} active={pathname === `/categoria/${c.slug}`} pokemon={c.slug === 'pokemon'}>
              {c.slug === 'pokemon' && <PokeballIcon />}
              {c.short}
            </NavChip>
          ))}
        </div>
      </nav>
    </header>
  )
}

// Espaço reservado enquanto a busca carrega (evita o header pular)
function SearchFallback() {
  return <div className="h-10 w-full rounded-full border bg-muted/50" />
}

function NavChip({ href, active, pokemon, children }: { href: string; active: boolean; pokemon?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
        pokemon
          ? // Pokémon: amarelo e azul clássicos
            active
            ? 'border-[#2a75bb] bg-[#2a75bb] font-bold text-[#ffcb05]'
            : 'border-[#2a75bb] bg-[#ffcb05] font-bold text-[#1d3d7a] hover:bg-[#ffd633]'
          : active
            ? 'border-transparent bg-foreground text-background'
            : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

// Pokébola minimalista para o chip da categoria Pokémon
function PokeballIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#1d1d1f" strokeWidth="2" />
      <path d="M1.5 12a10.5 10.5 0 0 1 21 0z" fill="#e3350d" stroke="#1d1d1f" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#1d1d1f" strokeWidth="2" />
    </svg>
  )
}
