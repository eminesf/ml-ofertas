import type { Metadata } from 'next'
import GoToStore from './GoToStore'

// Página de passagem do "Copiar e ir à loja": mostra que o cupom foi copiado e, depois de
// ~2s, segue para /r/CODE (link de afiliado — o cookie da loja fica com a gente).
// Só aceita código de link curto (nada de URL livre: evita open redirect).
export const metadata: Metadata = { title: 'Abrindo a loja…', robots: { index: false, follow: false } }

interface SP { r?: string; s?: string; cupom?: string; loja?: string }

export default async function IrPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const code = /^[A-Za-z0-9_-]{3,40}$/.test(sp.r || '') ? sp.r! : null
  const src = /^[twaic]$/.test(sp.s || '') ? sp.s! : ''
  const coupon = (sp.cupom || '').slice(0, 40)
  const store = (sp.loja || '').slice(0, 40)
  const target = code ? `/r/${code}${src ? `?${src}` : ''}` : '/'
  return <GoToStore target={target} coupon={coupon} store={store} />
}
