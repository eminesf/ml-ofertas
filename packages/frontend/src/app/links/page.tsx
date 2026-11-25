import type { Metadata } from 'next'
import { getChannels, getOffers, type Offer } from '@/lib/api'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site'
import { brl, storeName } from '@/lib/utils'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import TelegramIcon from '@/components/TelegramIcon'
import InstagramIcon, { INSTAGRAM_URL } from '@/components/InstagramIcon'

// Página "link na bio" do Instagram (@fox_promocoes_): grupos, canal, site e destaques do dia.
// Sem cabeçalho/rodapé do site (hideSiteChrome). Cliques nos destaques contam com origem "i".

export const revalidate = 300

export const metadata: Metadata = {
  title: `Links — ${SITE_NAME}`,
  description: 'Grupos de promoções no WhatsApp, canal no Telegram e as melhores ofertas do dia.',
  alternates: { canonical: '/links' },
}

const GROUP_EMOJI: Record<string, string> = { tech: '🎮', achadinhos: '🛍️' }

function rank(o: Offer): number {
  return (o.aiScore ?? 0) * 10 + Math.min(o.discountPct, 70) / 2 + o.upvotes
}

function LinkButton({ href, children, className = '', external = true }: { href: string; children: React.ReactNode; className?: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 font-bold shadow-sm transition-transform active:scale-[0.98] hover:-translate-y-0.5 ${className}`}
    >
      {children}
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
  const highlights = offers
    .filter(o => new Date(o.createdAt).getTime() >= since && o.imageUrl && (o.aiScore ?? 0) >= 6)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 6)

  return (
    <main className="min-h-dvh bg-[#ffe600] px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <img src="/logo_png.png" alt={SITE_NAME} className="size-24 rounded-full bg-white object-contain p-2 shadow-md" />
        <h1 className="mt-3 text-2xl font-black text-neutral-900">{SITE_NAME}</h1>
        <p className="mt-1 text-center text-sm font-semibold text-neutral-800">{SITE_TAGLINE}</p>

        <div className="mt-6 flex w-full flex-col gap-3">
          {groups.map(g => (
            <LinkButton key={g.key} href={g.url} className="bg-[#25D366] text-white">
              <WhatsAppIcon className="size-6 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block">
                  {GROUP_EMOJI[g.key] || ''} WhatsApp — {g.label}
                </span>
                {g.description && <span className="block text-xs font-medium text-white/85">{g.description}</span>}
              </span>
            </LinkButton>
          ))}
          <LinkButton href={telegram} className="bg-[#229ED9] text-white">
            <TelegramIcon className="size-6 shrink-0" />
            <span className="flex-1">Canal no Telegram</span>
          </LinkButton>
          <LinkButton href="/" external={false} className="bg-neutral-900 text-white">
            <span className="text-xl">🔥</span>
            <span className="flex-1">Todas as ofertas no site</span>
          </LinkButton>
          <LinkButton href="/categoria/pokemon" external={false} className="bg-white text-neutral-900">
            <span className="text-xl">⚡</span>
            <span className="flex-1">Pokémon TCG</span>
          </LinkButton>
        </div>

        {highlights.length > 0 && (
          <section className="mt-8 w-full">
            <h2 className="mb-3 text-center text-sm font-black uppercase tracking-wide text-neutral-900">Destaques de hoje</h2>
            <div className="grid grid-cols-2 gap-3">
              {highlights.map(o => (
                <a
                  key={o.id}
                  href={o.shortCode ? `/r/${o.shortCode}?i` : `/oferta/${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-transform active:scale-[0.98]"
                >
                  <div className="flex aspect-square items-center justify-center bg-white p-2">
                    <img src={o.imageUrl!} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="border-t border-neutral-100 p-2.5">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-neutral-800">{o.title}</p>
                    <p className="mt-1 text-sm font-black text-neutral-900">
                      {brl(o.salePrice)}
                      {o.discountPct > 0 && <span className="ml-1 text-xs font-bold text-red-600">-{o.discountPct}%</span>}
                    </p>
                    <p className="text-[11px] text-neutral-500">{storeName(o.provider)}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
          <InstagramIcon className="size-4" /> @fox_promocoes_
        </a>
      </div>
    </main>
  )
}
