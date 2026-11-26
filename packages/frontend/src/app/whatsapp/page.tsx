import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/site'
import GroupsLanding from '@/components/landing/GroupsLanding'

// Landing de ANÚNCIO: mesmo conteúdo da /links, sem os atalhos da bio. Fora do Google (noindex)
// e com origem própria ("lp") para separar na Análise.

export const revalidate = 300

export const metadata: Metadata = {
  title: `Promoções no WhatsApp — ${SITE_NAME}`,
  description: 'Descontos e cupons de verdade, todo dia no seu WhatsApp. Grátis, sem cadastro.',
  robots: { index: false, follow: true },
  openGraph: { title: 'Promoção de verdade, todo dia no seu WhatsApp', images: ['/opengraph-image'] },
}

export default function PaidLandingPage() {
  return <GroupsLanding origin="lp" />
}
