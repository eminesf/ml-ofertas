import Link from 'next/link'
import type { Metadata } from 'next'
import { Flame, X } from 'lucide-react'
import { getOffers } from '@/lib/api'
import { EmptyState, OfferGrid, Pagination, SortTabs, parseSort } from '@/components/Feed'

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { q, pagina } = await searchParams
  const page = Math.max(1, Number(pagina) || 1)
  // Busca interna não é indexada; páginas 2+ apontam para si mesmas
  if (q) return { title: `Busca: ${q}`, robots: { index: false, follow: true } }
  return {
    title: { absolute: 'Fox Promoções — Cupons e descontos de verdade todo dia' },
    alternates: { canonical: page > 1 ? `/?pagina=${page}` : '/' },
  }
}

const PAGE_SIZE = 24

interface SearchParams {
  ordenar?: string
  pagina?: string
  q?: string
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.pagina) || 1)
  const sort = parseSort(params.ordenar)
  const q = params.q?.trim() || undefined

  const { offers, total } = await getOffers({ limit: PAGE_SIZE, page, sort, q })
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const showHero = page === 1 && !q

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
      {showHero && (
        <section className="relative mb-6 overflow-hidden rounded-2xl bg-foreground px-5 py-6 text-background sm:mb-8 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-brand/25 blur-3xl" />
          <div className="relative max-w-xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">
              <Flame className="size-3.5 text-brand" /> Ofertas novas o dia todo
            </span>
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight sm:text-4xl">
              Desconto de verdade, todo dia. <span className="text-brand">Antes que acabe.</span>
            </h1>
            <p className="hidden text-sm text-white/70 sm:block sm:text-base">
              Preço lá embaixo, cupom e oferta relâmpago num lugar só. Corre, que promoção boa não espera ninguém.
            </p>
          </div>
        </section>
      )}

      {q && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold">
            Resultados para <span className="text-muted-foreground">&ldquo;{q}&rdquo;</span>
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" /> limpar
          </Link>
        </div>
      )}

      <div className="mb-4">
        <SortTabs base="/" sort={sort} q={q} total={total} />
      </div>

      {offers.length === 0 ? <EmptyState q={q} clearHref="/" /> : <OfferGrid offers={offers} />}

      <Pagination base="/" page={page} totalPages={totalPages} sort={sort} q={q} />
    </main>
  )
}
