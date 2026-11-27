import type { Metadata } from 'next'
import Link from 'next/link'
import { Flame, ShieldCheck, TicketPercent } from 'lucide-react'
import { getOffers, type Offer } from '@/lib/api'
import { OfferGrid } from '@/components/Feed'
import { collectCoupons } from '@/lib/seo-pages'
import { Breadcrumbs, CouponCards, Faq, JoinGroupsCta, Section, StoreLinks } from '@/components/seo/SeoBlocks'

// Página fixa de Black Friday (mesma URL todo ano: acumula autoridade no Google).
const YEAR = new Date().getFullYear()
// Black Friday = sexta depois da 4ª quinta de novembro; Cyber Monday = segunda seguinte
const bf = (() => { const d = new Date(Date.UTC(YEAR, 10, 1)); const firstThu = 1 + ((4 - d.getUTCDay() + 7) % 7); return firstThu + 21 + 1 })()

export async function generateMetadata(): Promise<Metadata> {
  const title = `Black Friday ${YEAR}: ofertas e cupons de verdade (atualizado hoje)`
  return {
    title,
    description: `As melhores ofertas da Black Friday ${YEAR} no Mercado Livre, Amazon, Shopee, KaBuM! e Nike, com preço conferido e cupons de desconto. Sem desconto falso.`,
    alternates: { canonical: '/black-friday' },
    openGraph: { title, url: '/black-friday' },
  }
}

const DAY = 86400000

// Melhores das últimas 72h: nota da IA, depois desconto
function best(offers: Offer[], n: number) {
  const since = Date.now() - 3 * DAY
  return offers
    .filter(o => new Date(o.createdAt).getTime() >= since && o.imageUrl)
    .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0) || b.discountPct - a.discountPct)
    .slice(0, n)
}

export default async function BlackFridayPage() {
  const [recent, page2, tech] = await Promise.all([
    getOffers({ limit: 100, sort: 'recent' }),
    getOffers({ limit: 100, sort: 'recent', page: 2 }),
    getOffers({ limit: 100, sort: 'recent', category: 'eletronicos' }),
  ])
  const all = [...recent.offers, ...page2.offers]
  const top = best(all, 12)
  const topIds = new Set(top.map(o => o.id))
  const bigDiscounts = all
    .filter(o => !topIds.has(o.id) && o.discountPct >= 40 && o.imageUrl && Date.now() - new Date(o.createdAt).getTime() < 3 * DAY)
    .sort((a, b) => b.discountPct - a.discountPct)
    .slice(0, 8)
  const techTop = best(tech.offers.filter(o => !topIds.has(o.id)), 8)
  const coupons = collectCoupons(all, 5).slice(0, 9)

  return (
    <main className="mx-auto max-w-6xl space-y-9 px-4 py-5 sm:py-8">
      <div>
        <Breadcrumbs items={[{ name: `Black Friday ${YEAR}`, href: '/black-friday' }]} />
        <div className="rounded-2xl bg-[#111] p-6 text-white sm:p-8">
          <p className="text-xs font-black tracking-[0.2em] text-[#ff8a1f] uppercase">Atualizado o dia todo</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight uppercase sm:text-5xl">
            Black Friday {YEAR} <span className="text-[#ff8a1f]">de verdade</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/75">
            A gente acompanha o preço dos produtos o ano todo. Aqui só entra oferta com desconto real, sem o famoso &ldquo;tudo pela metade do dobro&rdquo;.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <a href="#melhores" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"><Flame className="size-4 text-[#ff8a1f]" /> Melhores ofertas</a>
            <a href="#cupons" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"><TicketPercent className="size-4 text-[#ff8a1f]" /> Cupons</a>
            <a href="#tecnologia" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">🎮 Tecnologia e games</a>
            <a href="#como-saber" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"><ShieldCheck className="size-4 text-[#ff8a1f]" /> Desconto real?</a>
          </div>
        </div>
      </div>

      <Section id="melhores" title="Melhores ofertas da Black Friday agora">
        {top.length > 0 ? <OfferGrid offers={top} /> : <p className="text-sm text-muted-foreground">As ofertas estão entrando. Volte em instantes.</p>}
      </Section>

      <JoinGroupsCta origin="seo-blackfriday" />

      <Section id="cupons" title={`Cupons de desconto da Black Friday ${YEAR}`}>
        <CouponCards coupons={coupons} showStore />
        <Link href="/cupons" className="inline-block text-sm font-semibold underline underline-offset-4">Ver todos os cupons →</Link>
      </Section>

      {bigDiscounts.length > 0 && (
        <Section title="Descontos acima de 40%">
          <OfferGrid offers={bigDiscounts} />
        </Section>
      )}

      {techTop.length > 0 && (
        <Section id="tecnologia" title="Black Friday de tecnologia e games">
          <OfferGrid offers={techTop} />
          <Link href="/categoria/eletronicos" className="inline-block text-sm font-semibold underline underline-offset-4">Ver todos os eletrônicos →</Link>
        </Section>
      )}

      <Section title="Cupons por loja">
        <StoreLinks />
      </Section>

      <Section id="como-saber" title="Como saber se a promoção da Black Friday é de verdade">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>Compare com o preço das últimas semanas, não com o preço &ldquo;de&rdquo; da etiqueta. Loja que sobe o preço antes da Black Friday é o golpe mais comum.</li>
          <li>Confira o valor final no carrinho, com frete e cupom aplicados.</li>
          <li>Desconfie de desconto acima de 70% em produto caro, principalmente de vendedor sem avaliações.</li>
          <li>Prefira lojas e vendedores oficiais, com boa reputação.</li>
        </ul>
      </Section>

      <Section title="Perguntas frequentes">
        <Faq
          items={[
            { q: `Quando é a Black Friday ${YEAR}?`, a: `A Black Friday ${YEAR} é na sexta-feira, ${bf} de novembro. Muitas lojas começam as ofertas na semana anterior e estendem até a Cyber Monday (${bf + 3 > 30 ? `${bf + 3 - 30} de dezembro` : `${bf + 3} de novembro`}).` },
            { q: 'As ofertas desta página são de verdade?', a: 'Sim. O sistema acompanha o preço de cada produto e só publica quando o desconto é real em relação ao preço anterior. Mesmo assim, preço e estoque mudam rápido: confira na loja antes de pagar.' },
            { q: 'Onde receber as ofertas da Black Friday na hora?', a: 'Nos nossos grupos grátis do WhatsApp (Tech & TCG e Achadinhos) e no canal do Telegram @e_foxofertas. As melhores saem lá primeiro.' },
            { q: 'Vale mais a pena comprar na Black Friday ou na Cyber Monday?', a: 'Depende do produto. Eletrônicos costumam ter as melhores ofertas na sexta e no sábado; na Cyber Monday aparecem novos cupons. Acompanhe pelos grupos para não perder.' },
          ]}
        />
      </Section>
    </main>
  )
}
