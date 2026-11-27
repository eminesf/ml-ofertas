import { Nunito } from 'next/font/google'
import Link from 'next/link'
import type { Offer } from '@/lib/api'
import { SITE_NAME } from '@/lib/site'
import { brl, storeName } from '@/lib/utils'

// Peças das landing pages dos grupos (/grupo/tech, /grupo/achadinhos) e do anúncio (/whatsapp).
// Mesmo visual do flyer e da /links: fundo escuro, brilho laranja, logo grande.

export const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700', '800', '900'], display: 'swap' })

export const ORANGE = '#ff8a1f'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`${nunito.className} min-h-dvh bg-[#141414] text-white`}
      style={{
        backgroundImage:
          'radial-gradient(560px 420px at 50% 0%, rgba(249,115,22,.30), transparent 70%), radial-gradient(460px 320px at 50% 100%, rgba(249,115,22,.14), transparent 70%)',
        paddingBottom: 'calc(1.5rem + var(--cookie-bar-h, 0px))',
      }}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 pt-3">{children}</div>
    </main>
  )
}

export function Logo() {
  return (
    <img
      src="/logo-fox.webp"
      alt={SITE_NAME}
      width={190}
      height={171}
      className="h-auto w-[170px] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,.45)] sm:w-[190px]"
    />
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#5ee08f]">
      {children}
    </p>
  )
}

export function Headline({ main, highlight }: { main: string; highlight: string }) {
  return (
    <h1 className="mt-3 text-center text-[29px] font-black leading-[1.07] tracking-tight sm:text-[34px]">
      {main}
      <br />
      <span style={{ color: ORANGE }}>{highlight}</span>
    </h1>
  )
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-[30rem] text-center text-[16px] font-bold leading-snug text-neutral-300">{children}</p>
}

export function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-4 flex max-w-[30rem] flex-wrap justify-center gap-1.5">
      {items.map(c => (
        <span key={c} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[12.5px] font-extrabold text-neutral-200">
          {c}
        </span>
      ))}
    </div>
  )
}

export function Perks() {
  return (
    <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] font-extrabold text-neutral-400">
      <span><b className="text-[#7ac70c]">✓</b> Grátis</span>
      <span><b className="text-[#7ac70c]">✓</b> Sem cadastro</span>
      <span><b className="text-[#7ac70c]">✓</b> Saia quando quiser</span>
    </p>
  )
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4 text-center">
      <h2 className="text-[22px] font-black leading-tight">{children}</h2>
      {sub && <p className="mt-1 text-[14px] font-bold text-neutral-400">{sub}</p>}
    </div>
  )
}

function ago(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)}d`
}

// Ofertas REAIS que saíram no grupo (não "valores ilustrativos"), vindas da API a cada acesso.
// Cada card abre a página da oferta no site.
export function OfferProof({ offers }: { offers: Offer[] }) {
  if (!offers.length) return null
  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
      {offers.map(o => {
        const sent = o.posts?.[0]?.sentAt || o.createdAt
        return (
          <Link
            key={o.id}
            href={`/oferta/${o.id}`}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e] transition hover:-translate-y-0.5 hover:border-[#ff8a1f]/60"
          >
            <div className="relative flex aspect-square items-center justify-center bg-white p-3">
              <img src={o.imageUrl!} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
              {o.discountPct > 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-[#f97316] px-2 py-0.5 text-[11px] font-black text-black">-{o.discountPct}%</span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-2.5">
              <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-neutral-200">{o.title}</p>
              <p className="mt-auto pt-1.5 text-[16px] font-black">{brl(o.salePrice)}</p>
              <p className="text-[11px] font-semibold text-neutral-500">
                {storeName(o.provider)} · {ago(sent)}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

const BENEFITS = [
  { icon: '⚡', title: 'Chega na hora', text: 'Promoção boa acaba em minutos. A oferta cai no grupo assim que aparece.' },
  { icon: '🔎', title: 'Desconto de verdade', text: 'A gente confere o preço antes de postar. Nada de "de R$ 999 por R$ 499" inflado.' },
  { icon: '🎟️', title: 'Cupom junto', text: 'Quando tem cupom, ele vem no post com o valor final que você paga.' },
  { icon: '🔕', title: 'Sem bagunça', text: 'Só a gente posta. Sem conversa, sem corrente, só oferta.' },
]

export function Benefits() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {BENEFITS.map(b => (
        <div key={b.title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <span className="text-[26px] leading-none">{b.icon}</span>
          <div>
            <p className="text-[16px] font-black">{b.title}</p>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug text-neutral-400">{b.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function HowItWorks() {
  const steps = [
    'Toque no botão verde de entrar no grupo',
    'O WhatsApp abre o convite: toque em "Entrar"',
    'Pronto! As ofertas chegam no seu celular',
  ]
  return (
    <ol className="grid w-full gap-2.5">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[16px] font-black text-black" style={{ background: ORANGE }}>
            {i + 1}
          </span>
          <span className="text-[15px] font-extrabold">{s}</span>
        </li>
      ))}
    </ol>
  )
}

const FAQ = [
  { q: 'É grátis mesmo?', a: 'Sim. Não tem mensalidade, cadastro nem pegadinha. É só entrar no grupo.' },
  { q: 'Quem manda mensagem no grupo?', a: 'Só a equipe da Fox Promoções. Você recebe as ofertas e mais nada.' },
  { q: 'Eu compro com vocês?', a: 'Não. O link leva direto para a loja (Mercado Livre, Amazon, Shopee, KaBuM!, Nike…) e você compra lá, com a garantia da própria loja. A loja pode nos pagar uma comissão, sem custo extra para você.' },
  { q: 'Quantas mensagens chegam por dia?', a: 'Várias ao longo do dia, principalmente das 8h às 23h. Se preferir, silencie o grupo e confira quando quiser.' },
  { q: 'Como eu saio?', a: 'É só sair do grupo no WhatsApp, a qualquer momento.' },
]

export function Faq() {
  return (
    <div className="grid w-full gap-2">
      {FAQ.map(f => (
        <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 open:bg-white/[0.07]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-black [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="text-[20px] leading-none text-neutral-400 transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-[14px] font-semibold leading-snug text-neutral-400">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mt-10 max-w-[30rem] text-center text-[11.5px] font-semibold leading-relaxed text-neutral-500">
      {SITE_NAME} não é uma loja: divulgamos ofertas de lojas parceiras e alguns links são de afiliado.
      Preços e cupons podem mudar a qualquer momento.
      <br />
      <Link href="/" className="underline underline-offset-2 hover:text-neutral-300">foxpromocoes.com.br</Link>
      {' · '}
      <Link href="/privacidade" className="underline underline-offset-2 hover:text-neutral-300">Privacidade</Link>
    </footer>
  )
}

// Remove repetidos (mesmo produto por dois vendedores) e fica com os que têm foto
export function pickProof(offers: Offer[], n: number): Offer[] {
  const seen = new Set<string>()
  return offers.filter(o => {
    if (!o.imageUrl) return false
    const k = o.title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 24)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, n)
}
