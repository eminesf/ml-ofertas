import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/site'
import GroupsLanding from '@/components/landing/GroupsLanding'

// Link na bio do Instagram (@fox_promocoes_) e destino do QR code do flyer impresso.
// Desde 26/11/2026 é a mesma página da /whatsapp (escolha do grupo, ofertas reais, FAQ) mais os
// atalhos de Telegram, site, Pokémon e Instagram. Cliques em "entrar" contam com origem "links".

export const revalidate = 300

export const metadata: Metadata = {
  title: `Grupos de promoções no WhatsApp — ${SITE_NAME}`,
  description: 'Grupos de promoções no WhatsApp, canal no Telegram e as melhores ofertas do dia. Grátis, sem cadastro.',
  alternates: { canonical: '/links' },
}

export default function LinksPage() {
  return <GroupsLanding origin="links" bioLinks />
}
