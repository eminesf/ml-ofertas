import Link from 'next/link'
import type { Metadata } from 'next'
import { Flame } from 'lucide-react'
import { getOffers } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { OfferGrid } from '@/components/Feed'

// 404 próprio: oferta apagada (expirou) ou link errado. Em vez de beco sem saída,
// mostra as ofertas mais quentes do momento.
export const metadata: Metadata = {
  title: 'Essa oferta já acabou',
  robots: { index: false, follow: true },
}

export default async function NotFound() {
  let offers: Awaited<ReturnType<typeof getOffers>>['offers'] = []
  try {
    offers = (await getOffers({ sort: 'votes', limit: 8 })).offers
  } catch {
    // API fora do ar: mostra só a mensagem
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-6xl font-black tracking-tight text-foreground/90">404</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Ops, essa oferta voou!</h1>
        <p className="mt-3 text-muted-foreground">
          Promoção boa não dura muito — essa já acabou ou o link mudou. Mas calma: tem desconto fresquinho logo abaixo.
        </p>
        <Button asChild variant="brand" size="lg" className="mt-6 rounded-xl">
          <Link href="/">Ver ofertas de hoje</Link>
        </Button>
      </div>

      {offers.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
            <Flame className="size-5 text-orange-500" /> Bombando agora
          </h2>
          <OfferGrid offers={offers} />
        </section>
      )}
    </main>
  )
}
