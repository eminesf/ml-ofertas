import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOffers, type Offer } from '@/lib/api'
import { SITE_NAME } from '@/lib/site'
import JoinButton from '@/components/landing/JoinButton'
import { Shell, Logo, Eyebrow, Headline, Sub, Chips, Perks, SectionTitle, OfferProof, Benefits, HowItWorks, Faq, Footer, pickProof } from '@/components/landing/parts'

// Landing de cada grupo do WhatsApp: um público, uma ação (entrar no grupo).
// Mostra ofertas REAIS que saíram no grupo (GET /api/offers?group=…). Serve para bio, flyer
// direcionado e anúncio de nicho; com utm/fbclid na URL o clique conta como anúncio.

export const revalidate = 300

type Key = 'tech' | 'achadinhos'

const CONTENT: Record<Key, { title: string; description: string; eyebrow: string; main: string; highlight: string; sub: string; chips: string[]; cta: string }> = {
  tech: {
    title: 'Grupo de promoções Tech & Pokémon TCG no WhatsApp',
    description: 'TV, projetor, celular, PC gamer, PS5, Switch, games, Pokémon TCG e muito mais em tecnologia com desconto de verdade, direto no seu WhatsApp. Grátis.',
    eyebrow: 'Grupo grátis no WhatsApp',
    main: 'Promoção de tecnologia, games e Pokémon TCG',
    highlight: 'direto no seu WhatsApp',
    sub: 'TV, projetor, celular, fone, PC gamer, PS5, Switch, games, cartas Pokémon e muito mais com desconto de verdade. A gente garimpa o dia todo, você só aproveita.',
    chips: ['TV e projetor', 'Celular e fone', 'PC gamer', 'PS5 e Switch', 'Games', 'Pokémon TCG', 'e muito mais'],
    cta: 'Entrar no grupo Tech & TCG',
  },
  achadinhos: {
    title: 'Grupo de achadinhos e promoções no WhatsApp',
    description: 'Casa, cozinha, moda, beleza, Nike, Stanley e suplementos com desconto de verdade, direto no seu WhatsApp. Grátis.',
    eyebrow: 'Grupo grátis no WhatsApp',
    main: 'Achadinhos com desconto de verdade',
    highlight: 'todo dia no seu WhatsApp',
    sub: 'Casa, cozinha, moda, beleza, Nike, Stanley e suplementos. Só o que vale a pena, com cupom quando tem.',
    chips: ['Casa e cozinha', 'Moda', 'Nike', 'Stanley', 'Beleza', 'Suplementos'],
    cta: 'Entrar no grupo Achadinhos',
  },
}

export function generateStaticParams() {
  return [{ key: 'tech' }, { key: 'achadinhos' }]
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const c = CONTENT[key as Key]
  if (!c) return {}
  return {
    title: `${c.title} — ${SITE_NAME}`,
    description: c.description,
    alternates: { canonical: `/grupo/${key}` },
    openGraph: { title: c.title, description: c.description, images: ['/opengraph-image'] },
  }
}

export default async function GroupLandingPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const c = CONTENT[key as Key]
  if (!c) notFound()
  const group = key as Key
  const origin = `lp-${group}`

  const offers = await getOffers({ group, sort: 'recent', limit: 40 }).then(r => r.offers).catch(() => [] as Offer[])
  const proof = pickProof(offers, 6)
  const today = offers.filter(o => Date.now() - new Date(o.posts?.[0]?.sentAt || o.createdAt).getTime() < 24 * 3600_000).length

  return (
    <Shell>
      <Logo />
      <Eyebrow>{c.eyebrow}</Eyebrow>
      <Headline main={c.main} highlight={c.highlight} />
      <Sub>{c.sub}</Sub>
      <Chips items={c.chips} />
      <div className="mt-6 w-full max-w-sm">
        <JoinButton group={group} origin={origin} label={c.cta} />
      </div>
      <Perks />

      {proof.length > 0 && (
        <section className="mt-12 w-full">
          <SectionTitle sub={today >= 5 ? `${today >= 40 ? '40+' : today} ofertas no grupo nas últimas 24h` : 'Ofertas reais que acabaram de sair'}>
            Saiu no grupo <span style={{ color: '#ff8a1f' }}>agora há pouco</span>
          </SectionTitle>
          <OfferProof offers={proof} />
          <p className="mt-3 text-center text-[12px] font-semibold text-neutral-500">Preços do momento do post; podem ter mudado.</p>
        </section>
      )}

      <section className="mt-12 w-full">
        <SectionTitle>Por que entrar</SectionTitle>
        <Benefits />
      </section>

      <section className="mt-12 w-full">
        <SectionTitle>Como funciona</SectionTitle>
        <HowItWorks />
      </section>

      <section className="mt-12 w-full">
        <SectionTitle>Perguntas frequentes</SectionTitle>
        <Faq />
      </section>

      <section className="mt-12 flex w-full flex-col items-center text-center">
        <h2 className="text-[24px] font-black leading-tight">
          A próxima promoção <span style={{ color: '#ff8a1f' }}>pode ser a sua</span>
        </h2>
        <div className="mt-5 w-full max-w-sm">
          <JoinButton group={group} origin={origin} label={c.cta} />
        </div>
        <Perks />
      </section>

      <Footer />
    </Shell>
  )
}
