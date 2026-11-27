import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getOffers } from '@/lib/api'
import { OfferGrid } from '@/components/Feed'
import { collectCoupons, monthYear, storeBySlug } from '@/lib/seo-pages'
import { Breadcrumbs, CouponCards, Faq, JoinGroupsCta, Section, StoreLinks } from '@/components/seo/SeoBlocks'

// Página "cupom <loja>": cupons vistos nos últimos dias + ofertas recentes da loja.
export async function generateMetadata({ params }: { params: Promise<{ loja: string }> }): Promise<Metadata> {
  const { loja } = await params
  const s = storeBySlug(loja)
  if (!s) return {}
  const title = `Cupom ${s.name} hoje (${monthYear()}): códigos e promoções`
  return {
    title,
    description: `Cupom de desconto ${s.name} atualizado todo dia e ofertas com preço conferido. Copie o código, veja como usar e receba os próximos no WhatsApp.`,
    alternates: { canonical: `/cupom/${s.slug}` },
    openGraph: { title, url: `/cupom/${s.slug}` },
  }
}

export default async function CupomLojaPage({ params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params
  const s = storeBySlug(loja)
  if (!s) notFound()

  const { offers, total } = await getOffers({ provider: s.provider, limit: 100, sort: 'recent' })
  const coupons = collectCoupons(offers)
  const recent = offers.slice(0, 12)

  const faq = [
    { q: `Como usar cupom ${s.name}?`, a: s.howTo.join(' ') },
    { q: `Os cupons ${s.name} desta página funcionam?`, a: `São cupons que apareceram em ofertas nos últimos dias. Cupom de loja costuma ter estoque e prazo curtos, então pode ter acabado. Se não funcionar no carrinho, tente o próximo ou entre no nosso grupo para receber os novos assim que saem.` },
    { q: `Tem cupom ${s.name} com frete grátis?`, a: `Depende da promoção. Quando o cupom ou a oferta inclui frete grátis, isso aparece no post da oferta. Confira sempre no carrinho antes de pagar.` },
    { q: 'O Fox Promoções cobra alguma coisa?', a: 'Não. Os cupons e ofertas são gratuitos. Podemos receber uma comissão da loja quando você compra pelos nossos links, sem custo extra para você.' },
  ]

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-5 sm:py-8">
      <div>
        <Breadcrumbs items={[{ name: 'Cupons', href: '/cupons' }, { name: `Cupom ${s.name}`, href: `/cupom/${s.slug}` }]} />
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Cupom {s.name} hoje</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Atualizado em {monthYear()} · {coupons.length} cupom(ns) e {total.toLocaleString('pt-BR')} ofertas</p>
        <p className="mt-3 max-w-3xl text-muted-foreground">{s.intro}</p>
      </div>

      <Section title={`Cupons ${s.name} ativos`}>
        <CouponCards coupons={coupons} />
      </Section>

      <JoinGroupsCta origin={`seo-${s.slug}`} />

      <Section title={`Promoções ${s.name} de hoje`}>
        {recent.length > 0 ? <OfferGrid offers={recent} /> : <p className="text-sm text-muted-foreground">Nenhuma oferta desta loja nos últimos dias.</p>}
        <Link href={`/?q=${encodeURIComponent(s.name)}`} className="inline-block text-sm font-semibold underline underline-offset-4">Ver mais ofertas {s.name} →</Link>
      </Section>

      <Section title={`Como usar o cupom ${s.name}`}>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {s.howTo.map(step => <li key={step}>{step}</li>)}
        </ol>
        {s.tips.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {s.tips.map(t => <li key={t}>{t}</li>)}
          </ul>
        )}
      </Section>

      <Section title="Perguntas frequentes">
        <Faq items={faq} />
      </Section>

      <Section title="Cupons de outras lojas">
        <StoreLinks current={s.slug} />
      </Section>
    </main>
  )
}
