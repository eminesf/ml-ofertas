import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, Flame, Percent, SearchX, Sparkles } from 'lucide-react'
import type { Offer } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import OfferCard from './OfferCard'

export type Sort = 'recent' | 'votes' | 'discount' | 'score'

export const SORTS: { value: Sort; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'recent', label: 'Novas', icon: Clock },
  { value: 'votes', label: 'Quentes', icon: Flame },
  { value: 'discount', label: 'Maior desconto', icon: Percent },
  { value: 'score', label: 'Top ofertas', icon: Sparkles },
]

export function parseSort(value?: string): Sort {
  return SORTS.some(s => s.value === value) ? (value as Sort) : 'recent'
}

function href(base: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `${base}?${s}` : base
}

export function SortTabs({ base, sort, q, total }: { base: string; sort: Sort; q?: string; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="no-scrollbar -mx-4 flex flex-1 gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex rounded-full border bg-muted/60 p-1">
          {SORTS.map(({ value, label, icon: Icon }) => (
            <Link
              key={value}
              href={href(base, { ordenar: value === 'recent' ? undefined : value, q })}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                sort === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
      <span className="hidden shrink-0 text-sm text-muted-foreground tabular-nums sm:block">
        {total.toLocaleString('pt-BR')} ofertas
      </span>
    </div>
  )
}

export function OfferGrid({ offers }: { offers: Offer[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {offers.map(o => (
        <OfferCard key={o.id} offer={o} />
      ))}
    </div>
  )
}

export function EmptyState({ q, clearHref }: { q?: string; clearHref: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-6 text-muted-foreground" />
      </span>
      <p className="font-semibold">{q ? `Nada encontrado para "${q}"` : 'Nenhuma oferta por aqui ainda'}</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {q ? 'Tente outro termo ou veja todas as ofertas.' : 'Novas promoções entram várias vezes por dia. Volte mais tarde!'}
      </p>
      {q && (
        <Button asChild variant="outline" size="sm">
          <Link href={clearHref}>Limpar busca</Link>
        </Button>
      )}
    </div>
  )
}

export function Pagination({
  base,
  page,
  totalPages,
  sort,
  q,
}: {
  base: string
  page: number
  totalPages: number
  sort: Sort
  q?: string
}) {
  if (totalPages <= 1) return null
  const link = (p: number) => href(base, { ordenar: sort === 'recent' ? undefined : sort, pagina: p > 1 ? p : undefined, q })

  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href={link(page - 1)} aria-label="Página anterior">
            <ChevronLeft /> <span className="hidden sm:inline">Anterior</span>
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled className="gap-1" aria-label="Página anterior">
          <ChevronLeft /> <span className="hidden sm:inline">Anterior</span>
        </Button>
      )}

      <div className="hidden items-center gap-1 sm:flex">
        {buildPageNumbers(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-2 text-sm text-muted-foreground">…</span>
          ) : (
            <Button key={p} asChild variant={p === page ? 'default' : 'ghost'} size="sm" className="min-w-8 px-2">
              <Link href={link(p)} aria-current={p === page ? 'page' : undefined}>{p}</Link>
            </Button>
          ),
        )}
      </div>
      <span className="px-3 text-sm text-muted-foreground tabular-nums sm:hidden">
        {page} de {totalPages}
      </span>

      {page < totalPages ? (
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href={link(page + 1)} aria-label="Próxima página">
            <span className="hidden sm:inline">Próxima</span> <ChevronRight />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled className="gap-1" aria-label="Próxima página">
          <span className="hidden sm:inline">Próxima</span> <ChevronRight />
        </Button>
      )}
    </nav>
  )
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
