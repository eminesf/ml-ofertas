import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import CouponCopy from '@/components/CouponCopy'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { brl, storeName, timeAgo } from '@/lib/utils'
import { STORE_PAGES, type CouponSummary } from '@/lib/seo-pages'
import { SITE_URL } from '@/lib/site'

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const all = [{ name: 'Início', href: '/' }, ...items]
  return (
    <>
      <nav aria-label="Navegação" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {all.map((it, i) => (
          <span key={it.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" />}
            {i < all.length - 1 ? <Link href={it.href} className="hover:text-foreground">{it.name}</Link> : <span className="text-foreground">{it.name}</span>}
          </span>
        ))}
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.href === '/' ? '' : it.href}` })),
        }}
      />
    </>
  )
}

export function CouponCards({ coupons, showStore = false }: { coupons: CouponSummary[]; showStore?: boolean }) {
  if (coupons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhum cupom ativo encontrado nos últimos dias. Novos cupons entram várias vezes por dia: entre no grupo para receber na hora.
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {coupons.map(c => {
        const first = c.offers[0]
        return (
          <div key={`${c.provider}:${c.code}`} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {showStore ? <span className="font-semibold text-foreground">{storeName(c.provider)}</span> : <span>Cupom</span>}
              <span>visto {timeAgo(c.lastSeen)}</span>
            </div>
            <CouponCopy code={c.code} variant="box" minValue={c.minValue} goHref={first.shortCode ? `/r/${first.shortCode}?c` : first.affiliateUrl} />
            <Link href={`/oferta/${first.id}`} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 hover:bg-muted">
              {first.imageUrl && <img src={first.imageUrl} alt="" className="size-12 shrink-0 rounded-md bg-white object-contain" loading="lazy" />}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-medium">{first.title}</span>
                <span className="text-sm font-bold">{brl(first.salePrice)}</span>
              </span>
            </Link>
            {c.offers.length > 1 && <p className="text-xs text-muted-foreground">Vale em mais {c.offers.length - 1} oferta(s) desta lista.</p>}
          </div>
        )
      })}
    </div>
  )
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <>
      <div className="divide-y rounded-xl border bg-card">
        {items.map(it => (
          <details key={it.q} className="group px-4 py-3">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="flex items-center justify-between gap-3">
                {it.q}
                <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
              </span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })),
        }}
      />
    </>
  )
}

export function JoinGroupsCta({ origin }: { origin: string }) {
  return (
    <section className="rounded-2xl bg-[#0f1f15] p-5 text-white sm:p-6">
      <p className="text-lg font-extrabold">Receba os cupons na hora no WhatsApp</p>
      <p className="mt-1 text-sm text-white/70">Cupom bom acaba em minutos. Nos grupos, ele chega assim que a gente encontra. Grátis, sem spam.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a href={`/entrar/tech?o=${origin}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-bold text-white hover:bg-[#1ebe5b]">
          <WhatsAppIcon className="size-5" /> Tech & TCG
        </a>
        <a href={`/entrar/achadinhos?o=${origin}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-bold text-white hover:bg-[#1ebe5b]">
          <WhatsAppIcon className="size-5" /> Achadinhos
        </a>
      </div>
    </section>
  )
}

export function StoreLinks({ current }: { current?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STORE_PAGES.filter(s => s.slug !== current).map(s => (
        <Link key={s.slug} href={`/cupom/${s.slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:border-foreground/40">
          Cupom {s.name}
        </Link>
      ))}
    </div>
  )
}

export function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

