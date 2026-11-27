import { getOffers, getChannels, type Offer } from '@/lib/api'
import JoinButton from '@/components/landing/JoinButton'
import TelegramIcon from '@/components/TelegramIcon'
import InstagramIcon, { INSTAGRAM_URL } from '@/components/InstagramIcon'
import { Shell, Logo, Eyebrow, Headline, Sub, Perks, SectionTitle, OfferProof, Benefits, HowItWorks, Faq, Footer, pickProof } from '@/components/landing/parts'

// Página única dos 2 grupos — usada pela /links (bio do Instagram + QR code do flyer, origem
// "links", com os atalhos de Telegram/site/Pokémon) e pela /whatsapp (anúncio, origem "lp").
// Uma ação principal: escolher um grupo e entrar. Clique com utm/fbclid ganha "-ads" e dispara
// Lead no pixel da Meta.

const GROUPS = [
  {
    key: 'tech' as const,
    emoji: '🎮',
    name: 'Tech & TCG',
    text: 'Tecnologia em geral: TV, projetor, celular, PC gamer, PS5, Switch, games, Pokémon TCG e muito mais.',
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

function Tile({ href, icon, label, external = true }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-2 py-3.5 text-center text-[13px] font-extrabold leading-tight text-white transition active:scale-[0.97] hover:bg-white/[0.09]"
    >
      {icon}
      {label}
    </a>
  )
}

export default async function GroupsLanding({ origin, bioLinks = false }: { origin: string; bioLinks?: boolean }) {
  const telegram = bioLinks ? (await getChannels()).telegram : ''
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
        <GroupChoice origin={origin} />
      </div>
      <Perks />

      {bioLinks && (
        <div className="mt-6 grid w-full grid-cols-3 gap-3">
          <Tile href={telegram} label="Canal no Telegram" icon={<TelegramIcon className="size-7 text-[#29A9EB]" />} />
          <Tile href="/" external={false} label="Todas as ofertas" icon={<span className="text-[26px] leading-7">🔥</span>} />
          <Tile href="/categoria/pokemon" external={false} label="Pokémon TCG" icon={<span className="text-[26px] leading-7">⚡</span>} />
        </div>
      )}

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
        <GroupChoice origin={origin} />
        <Perks />
      </section>

      {bioLinks && (
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 flex items-center gap-1.5 text-[13px] font-bold text-neutral-400 hover:text-white"
        >
          <InstagramIcon className="size-4" /> @fox_promocoes_
        </a>
      )}

      <Footer />
    </Shell>
  )
}
