import Link from 'next/link'
import type { Metadata } from 'next'
import { X } from 'lucide-react'
import { getOffers } from '@/lib/api'
import { EmptyState, OfferGrid, Pagination, SortTabs, parseSort } from '@/components/Feed'
import { CATEGORIES } from '@/lib/utils'

const PAGE_SIZE = 24

function labelFor(slug: string) {
  return CATEGORIES.find(c => c.slug === slug)?.label || (slug === 'geral' ? 'Geral' : slug)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const label = labelFor(slug)
  return {
    title: `${label} em promoção — Fox Ofertas`,
    description: `Promoções e cupons de ${label.toLowerCase()} com desconto de verdade no Fox Ofertas.`,
  }
}

interface SearchParams {
  pagina?: string
  q?: string
  ordenar?: string
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const sp = await searchParams
  const page = Math.max(1, Number(sp.pagina) || 1)
  const sort = parseSort(sp.ordenar)
  const q = sp.q?.trim() || undefined
  const base = `/categoria/${slug}`

  const { offers, total } = await getOffers({ category: decodeURIComponent(slug), limit: PAGE_SIZE, page, sort, q })
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Categoria</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{labelFor(slug)}</h1>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">{total.toLocaleString('pt-BR')} ofertas</span>
      </div>

      {q && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="font-semibold">
            Resultados para <span className="text-muted-foreground">&ldquo;{q}&rdquo;</span>
          </p>
          <Link
            href={base}
            className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" /> limpar
          </Link>
        </div>
      )}

      <div className="mb-4">
        <SortTabs base={base} sort={sort} q={q} total={total} />
      </div>

      {offers.length === 0 ? <EmptyState q={q} clearHref={base} /> : <OfferGrid offers={offers} />}

      <Pagination base={base} page={page} totalPages={totalPages} sort={sort} q={q} />
    </main>
  )
}
