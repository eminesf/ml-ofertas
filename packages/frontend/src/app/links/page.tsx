import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import { getChannels, getOffers, type Offer } from '@/lib/api'
import { SITE_NAME } from '@/lib/site'
import { brl, storeName } from '@/lib/utils'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import TelegramIcon from '@/components/TelegramIcon'
import InstagramIcon, { INSTAGRAM_URL } from '@/components/InstagramIcon'

// Página "link na bio" do Instagram (@fox_promocoes_) e destino do QR code do flyer impresso:
// grupos, canal, site e destaques do dia. Visual escuro + laranja, igual ao flyer, para quem
// escaneia reconhecer na hora. Sem cabeçalho/rodapé do site (hideSiteChrome).
// Cliques nos destaques contam com origem "i".

export const revalidate = 300

const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700', '800', '900'], display: 'swap' })

export const metadata: Metadata = {
  title: `Links — ${SITE_NAME}`,
  description: 'Grupos de promoções no WhatsApp, canal no Telegram e as melhores ofertas do dia.',
  alternates: { canonical: '/links' },
}

const GROUP_EMOJI: Record<string, string> = { tech: '🎮', achadinhos: '🛍️' }

function rank(o: Offer): number {
  return (o.aiScore ?? 0) * 10 + Math.min(o.discountPct, 70) / 2 + o.upvotes
}

// Mesmo produto em duas ofertas (ex.: Switch por dois vendedores) aparece uma vez só
function sameProductKey(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 24)
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

export default async function LinksPage() {
  const [{ whatsappGroups, whatsapp, telegram }, offers] = await Promise.all([
    getChannels(),
    getOffers({ sort: 'recent', limit: 100 }).then(r => r.offers).catch(() => [] as Offer[]),
  ])
  const groups = whatsappGroups.length ? whatsappGroups : whatsapp ? [{ key: 'tech', label: 'Grupo de promoções', description: '', url: whatsapp }] : []

  const since = Date.now() - 24 * 3600_000
  const today = offers.filter(o => new Date(o.createdAt).getTime() >= since)
  const seen = new Set<string>()
  const highlights = today
    .filter(o => o.imageUrl && (o.aiScore ?? 0) >= 6)
    .sort((a, b) => rank(b) - rank(a))
    .filter(o => {
      const k = sameProductKey(o.title)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 6)

  return (
    <main
      className={`${nunito.className} min-h-dvh bg-[#141414] text-white`}
      style={{
        backgroundImage:
          'radial-gradient(520px 380px at 50% 0%, rgba(249,115,22,.30), transparent 70%), radial-gradient(420px 300px at 50% 100%, rgba(249,115,22,.16), transparent 70%)',
        paddingBottom: 'calc(2rem + var(--cookie-bar-h, 0px))',
      }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-4">
        <img
          src="/logo_png.png"
          alt={SITE_NAME}
          width={260}
          height={170}
          className="h-[170px] w-[260px] object-cover object-[50%_52%] drop-shadow-[0_8px_24px_rgba(0,0,0,.45)]"
        />

        <h1 className="mt-1 text-center text-[26px] font-black leading-[1.08] tracking-tight">
          Promoção de verdade,
          <br />
          <span className="text-[#ff8a1f]">todo dia no seu celular</span>
        </h1>
        <p className="mt-2.5 max-w-[22rem] text-center text-[15px] font-bold leading-snug text-neutral-300">
          A gente garimpa os melhores descontos e cupons e manda no WhatsApp. É só entrar no grupo.
        </p>

        {today.length > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-extrabold text-neutral-200">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#25D366] opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[#25D366]" />
            </span>
            {today.length >= 100 ? '100+' : today.length} ofertas nas últimas 24h
          </p>
        )}

        {/* Grupos do WhatsApp — o principal */}
        <div className="mt-6 flex w-full flex-col gap-3">
          {groups.map(g => (
            <a
              key={g.key}
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3.5 rounded-3xl bg-white p-3.5 pr-4 text-neutral-900 shadow-[0_6px_24px_rgba(0,0,0,.35)] transition active:scale-[0.98] hover:-translate-y-0.5"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white">
                <WhatsAppIcon className="size-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-black leading-tight">
                  {g.label} {GROUP_EMOJI[g.key] || ''}
                </span>
                {g.description && <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-neutral-500">{g.description}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-[#25D366] px-3.5 py-2 text-[13px] font-black text-white">Entrar</span>
            </a>
          ))}
        </div>

        <div className="mt-3 grid w-full grid-cols-3 gap-3">
          <Tile href={telegram} label="Canal no Telegram" icon={<TelegramIcon className="size-7 text-[#29A9EB]" />} />
          <Tile href="/" external={false} label="Todas as ofertas" icon={<span className="text-[26px] leading-7">🔥</span>} />
          <Tile href="/categoria/pokemon" external={false} label="Pokémon TCG" icon={<span className="text-[26px] leading-7">⚡</span>} />
        </div>

        <p className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] font-extrabold text-neutral-400">
          <span><b className="text-[#7ac70c]">✓</b> Grátis</span>
          <span><b className="text-[#7ac70c]">✓</b> Sem spam</span>
          <span><b className="text-[#7ac70c]">✓</b> Saia quando quiser</span>
        </p>

        {highlights.length > 0 && (
          <section className="mt-9 w-full">
            <h2 className="mb-3 text-center text-[13px] font-black uppercase tracking-[0.14em] text-[#ff8a1f]">Destaques de hoje</h2>
            <div className="grid grid-cols-2 gap-3">
              {highlights.map(o => (
                <a
                  key={o.id}
                  href={o.shortCode ? `/r/${o.shortCode}?i` : `/oferta/${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e] transition active:scale-[0.98] hover:border-white/25"
                >
                  <div className="relative flex aspect-square items-center justify-center bg-white p-3">
                    <img src={o.imageUrl!} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                    {o.discountPct > 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#f97316] px-2 py-0.5 text-[11px] font-black text-black">-{o.discountPct}%</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-neutral-200">{o.title}</p>
                    <p className="mt-auto pt-1.5 text-[16px] font-black text-white">{brl(o.salePrice)}</p>
                    <p className="text-[11px] font-semibold text-neutral-500">{storeName(o.provider)}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-9 flex items-center gap-1.5 text-[13px] font-bold text-neutral-400 hover:text-white"
        >
          <InstagramIcon className="size-4" /> @fox_promocoes_
        </a>
      </div>
    </main>
  )
}
