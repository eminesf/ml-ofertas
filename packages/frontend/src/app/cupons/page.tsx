import type { Metadata } from 'next'
import Link from 'next/link'
import { getOffers } from '@/lib/api'
import { STORE_PAGES, collectCoupons, monthYear } from '@/lib/seo-pages'
import { Breadcrumbs, CouponCards, Faq, JoinGroupsCta, Section } from '@/components/seo/SeoBlocks'

export async function generateMetadata(): Promise<Metadata> {
  const title = `Cupons de desconto hoje (${monthYear()}): Mercado Livre, Amazon, Shopee e mais`
  return {
    title,
    description: 'Cupons de desconto válidos encontrados nos últimos dias no Mercado Livre, Amazon, Shopee, KaBuM!, Nike e Stanley. Copie o código e aproveite antes que acabe.',
    alternates: { canonical: '/cupons' },
    openGraph: { title, url: '/cupons' },
  }
}

export default async function CuponsPage() {
  const { offers } = await getOffers({ limit: 100, sort: 'recent' })
  const coupons = collectCoupons(offers)
  const perStore = new Map<string, number>()
  coupons.forEach(c => perStore.set(c.provider, (perStore.get(c.provider) || 0) + 1))

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-5 sm:py-8">
      <div>
        <Breadcrumbs items={[{ name: 'Cupons', href: '/cupons' }]} />
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Cupons de desconto de hoje</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Atualizado em {monthYear()}</p>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Os cupons que a gente encontrou nos últimos dias nas principais lojas, junto com a oferta em que cada um apareceu. Escolha a loja ou copie direto daqui.
        </p>
      </div>

      <Section title="Cupons por loja">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STORE_PAGES.map(s => (
            <Link key={s.slug} href={`/cupom/${s.slug}`} className="rounded-xl border bg-card p-4 hover:border-foreground/40">
              <span className="block font-bold">Cupom {s.name}</span>
              <span className="text-xs text-muted-foreground">{perStore.get(s.provider) ? `${perStore.get(s.provider)} cupom(ns) agora` : 'ver ofertas'}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Últimos cupons encontrados">
        <CouponCards coupons={coupons.slice(0, 18)} showStore />
      </Section>

      <JoinGroupsCta origin="seo-cupons" />

      <Section title="Perguntas frequentes">
        <Faq
          items={[
            { q: 'Esses cupons são válidos?', a: 'São cupons vistos em ofertas nos últimos dias. Cupom de loja tem prazo e estoque curtos, então pode ter acabado. Teste no carrinho; se não funcionar, tente outro.' },
            { q: 'Onde coloco o código do cupom?', a: 'No carrinho ou na finalização da compra, no campo "cupom", "código promocional" ou "vale". Cada loja tem um passo a passo na página da loja.' },
            { q: 'Como receber cupons novos antes de acabar?', a: 'Entre num dos nossos grupos grátis do WhatsApp ou no canal do Telegram: os cupons chegam assim que a gente encontra.' },
          ]}
        />
      </Section>
    </main>
  )
}
