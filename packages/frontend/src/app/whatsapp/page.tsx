import type { Metadata } from 'next'
import { getOffers, type Offer } from '@/lib/api'
import { SITE_NAME } from '@/lib/site'
import JoinButton from '@/components/landing/JoinButton'
import { Shell, Logo, Eyebrow, Headline, Sub, Perks, SectionTitle, OfferProof, Benefits, HowItWorks, Faq, Footer, pickProof } from '@/components/landing/parts'

// Landing de ANÚNCIO (tráfego pago, ex.: Instagram): uma ação só — escolher um dos 2 grupos e
// entrar. Fora do Google (noindex) para não competir com /grupo/*. Clique conta como origem "lp"
// (ou "lp-ads" com utm/fbclid) e dispara Lead no pixel da Meta.

export const revalidate = 300

export const metadata: Metadata = {
  title: `Promoções no WhatsApp — ${SITE_NAME}`,
  description: 'Descontos e cupons de verdade, todo dia no seu WhatsApp. Grátis, sem cadastro.',
  robots: { index: false, follow: true },
  openGraph: { title: 'Promoção de verdade, todo dia no seu WhatsApp', images: ['/opengraph-image'] },
}

const GROUPS = [
  {
    key: 'tech' as const,
    emoji: '🎮',
    name: 'Tech & TCG',
    text: 'PC gamer, placa de vídeo, PS5, Switch, games, periféricos e Pokémon TCG.',
  },
  {
    key: 'achadinhos' as const,
    emoji: '🛍️',
    name: 'Achadinhos',
    text: 'Casa, cozinha, moda, beleza, Nike, Stanley e suplementos.',
  },
]

function GroupChoice({ origin }: { origin: string }) {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {GROUPS.map(g => (
        <div key={g.key} className="flex flex-col rounded-3xl bg-white p-4 text-neutral-900 shadow-[0_8px_28px_rgba(0,0,0,.4)]">
          <p className="text-[20px] font-black leading-tight">
            {g.emoji} {g.name}
          </p>
          <p className="mt-1 mb-3.5 text-[14px] font-semibold leading-snug text-neutral-500">{g.text}</p>
          <JoinButton group={g.key} origin={origin} size="md" label="Entrar neste grupo" className="mt-auto shadow-none" />
        </div>
      ))}
    </div>
  )
}

export default async function PaidLandingPage() {
  const [tech, achadinhos] = await Promise.all(
    (['tech', 'achadinhos'] as const).map(group =>
      getOffers({ group, sort: 'recent', limit: 20 }).then(r => r.offers).catch(() => [] as Offer[])
    )
  )
  // Intercala os dois grupos para a vitrine mostrar os dois públicos
  const mixed: Offer[] = []
  for (let i = 0; i < 20; i++) {
    if (tech[i]) mixed.push(tech[i])
    if (achadinhos[i]) mixed.push(achadinhos[i])
  }
  const proof = pickProof(mixed, 6)

  return (
    <Shell>
      <Logo />
      <Eyebrow>Grupos grátis no WhatsApp</Eyebrow>
      <Headline main="Promoção de verdade," highlight="todo dia no seu WhatsApp" />
      <Sub>A gente garimpa os melhores descontos e cupons da internet e manda no grupo. Escolha o seu e entre em 1 toque.</Sub>

      <div className="mt-6 w-full">
        <GroupChoice origin="lp" />
      </div>
      <Perks />

      {proof.length > 0 && (
        <section className="mt-12 w-full">
          <SectionTitle sub="Ofertas reais que acabaram de sair nos grupos">
            Saiu nos grupos <span style={{ color: '#ff8a1f' }}>agora há pouco</span>
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
        <h2 className="mb-5 text-[24px] font-black leading-tight">
          Escolha seu grupo e <span style={{ color: '#ff8a1f' }}>comece a economizar</span>
        </h2>
        <GroupChoice origin="lp" />
        <Perks />
      </section>

      <Footer />
    </Shell>
  )
}
