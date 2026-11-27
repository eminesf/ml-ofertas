import Link from 'next/link'
import type { Metadata } from 'next'
import { Flame, TicketPercent, X } from 'lucide-react'
import { getOffers } from '@/lib/api'
import { EmptyState, OfferGrid, Pagination, SortTabs, parseSort } from '@/components/Feed'
import { STORE_PAGES } from '@/lib/seo-pages'

// Banner da Black Friday até o fim da Cyber Monday (1/12 00h de Brasília); depois volta o banner normal
const BLACK_FRIDAY_UNTIL = Date.parse('2026-12-01T00:00:00-03:00')

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
  const BLACK_FRIDAY = Date.now() < BLACK_FRIDAY_UNTIL

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
      {showHero && (BLACK_FRIDAY ? (
        <section className="relative mb-4 overflow-hidden rounded-2xl bg-[#0d0d0d] px-5 py-6 text-white sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-[#ff8a1f]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-60 rounded-full bg-[#ff8a1f]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background:repeating-linear-gradient(-45deg,#fff_0_4px,transparent_4px_22px)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff8a1f] px-2.5 py-1 text-xs font-black tracking-wide text-black uppercase">
                <Flame className="size-3.5" /> Black Friday {new Date().getFullYear()}
              </span>
              <h1 className="text-3xl leading-[0.95] font-black tracking-tight uppercase sm:text-5xl">
                Black Friday <span className="block text-[#ff8a1f]">de verdade</span>
              </h1>
              <p className="text-sm text-white/75 sm:text-base">
                Preço conferido, sem a metade do dobro. As melhores ofertas e cupons do Mercado Livre, Amazon, Shopee, KaBuM! e Nike, atualizados o dia todo.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-72">
              <Link href="/black-friday" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff8a1f] px-5 py-3 font-extrabold text-black transition hover:bg-[#ffa04a]">
                <Flame className="size-4" /> Ver ofertas da Black Friday
              </Link>
              <Link href="/cupons" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 font-bold text-white transition hover:bg-white/10">
                <TicketPercent className="size-4" /> Cupons de hoje
              </Link>
            </div>
          </div>
        </section>
      ) : (
          <section className="relative mb-4 overflow-hidden rounded-2xl bg-foreground px-5 py-6 text-background sm:mb-8 sm:px-8 sm:py-9">
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
      ))}

      {showHero && (
        <nav aria-label="Cupons por loja" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mb-8 sm:flex-wrap sm:px-0">
          <Link href="/cupons" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-bold text-black">
            <TicketPercent className="size-4" /> Cupons
          </Link>
          {STORE_PAGES.map(st => (
            <Link key={st.slug} href={"/cupom/" + st.slug} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:border-foreground/40">
              Cupom {st.name}
            </Link>
          ))}
        </nav>
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
