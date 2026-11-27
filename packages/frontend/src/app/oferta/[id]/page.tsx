import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ExternalLink, ShieldCheck, ShoppingBag, Sparkles, Star, TrendingDown } from 'lucide-react'
import { getOffer, getOffers } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { OfferGrid } from '@/components/Feed'
import VoteButton from '@/components/VoteButton'
import CouponCopy from '@/components/CouponCopy'
import BackButton from '@/components/BackButton'
import { STORES, brl, cn, couponGoHref, storeName, timeAgo } from '@/lib/utils'
import { SITE_URL } from '@/lib/site'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const offer = await getOffer(id)
  if (!offer) return {}

  const discountStr = offer.discountPct > 0 ? ` (-${offer.discountPct}% OFF)` : ''
  const description = `${brl(offer.salePrice)}${discountStr} em ${storeName(offer.provider)}. Encontre as melhores promoções no Fox Promoções.`

  return {
    title: offer.title.length > 70 ? offer.title.slice(0, 67) + '…' : offer.title,
    description,
    alternates: { canonical: `/oferta/${offer.id}` },
    openGraph: {
      title: offer.title,
      description,
      images: offer.imageUrl ? [{ url: offer.imageUrl, width: 600, height: 600, alt: offer.title }] : [],
      type: 'website',
      url: `/oferta/${offer.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: offer.title,
      description,
      images: offer.imageUrl ? [offer.imageUrl] : [],
    },
  }
}

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const offer = await getOffer(id)
  if (!offer) notFound()

  const { offers: related } = await getOffers({ category: offer.category, limit: 9 })
  const relatedOffers = related.filter(o => o.id !== offer.id).slice(0, 8)

  const hasDiscount = offer.discountPct > 0 && offer.originalPrice > offer.salePrice
  const store = STORES[offer.provider]
  const cta = (
    <Button asChild variant="brand" size="lg" className="h-12 w-full rounded-xl text-base">
      <a href={offer.shortCode ? `/r/${offer.shortCode}` : offer.affiliateUrl} target="_blank" rel="noopener noreferrer sponsored">
        Ir para {storeName(offer.provider)} <ExternalLink />
      </a>
    </Button>
  )

  // Dados estruturados do produto (preço e imagem nos resultados do Google)
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: offer.title,
    ...(offer.imageUrl ? { image: [offer.imageUrl] } : {}),
    ...(offer.category ? { category: offer.category } : {}),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/oferta/${offer.id}`,
      price: offer.salePrice.toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: storeName(offer.provider) },
    },
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 pb-28 sm:py-8 sm:pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).split('<').join('\\u003c') }} />
      <BackButton />

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8">
        <div className="relative overflow-hidden rounded-2xl border bg-white">
          <div className="relative aspect-square">
            {offer.imageUrl ? (
              <img src={offer.imageUrl} alt={offer.title} className="absolute inset-0 size-full object-contain p-6 sm:p-10" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <ShoppingBag className="size-16" />
              </div>
            )}
          </div>
          {hasDiscount && (
            <Badge variant="deal" className="absolute top-3 left-3 px-2 py-1 text-sm">
              -{offer.discountPct}%
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {store && <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', store.className)}>{store.label}</span>}
            {!hasDiscount && (
              <Badge className="bg-violet-600">
                <Sparkles /> Oferta especial
              </Badge>
            )}
            {offer.aiScore ? (
              <Badge variant="success">
                <Sparkles /> Nota {offer.aiScore}/10
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">· {timeAgo(offer.createdAt)}</span>
          </div>

          <h1 className="text-xl leading-snug font-bold tracking-tight sm:text-2xl">{offer.title}</h1>

          {offer.rating ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              <span className="font-medium text-foreground">{offer.rating.toFixed(1)}</span> de avaliação na loja
            </p>
          ) : null}

          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            {hasDiscount && <p className="text-sm text-muted-foreground line-through">{brl(offer.originalPrice)}</p>}
            <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{brl(offer.salePrice)}</p>
            {hasDiscount && (
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-success">
                <TrendingDown className="size-4" /> Você economiza {brl(offer.originalPrice - offer.salePrice)}
              </p>
            )}
            <div className="mt-4 hidden sm:block">{cta}</div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Compra feita direto no site oficial da loja.
            </p>
          </div>

          {offer.couponCode && (
            <CouponCopy
              code={offer.couponCode}
              variant="box"
              amount={offer.couponAmount ?? undefined}
              minValue={offer.couponMinValue}
              goHref={couponGoHref(offer, offer.couponCode)}
            />
          )}

          {offer.suggestedHighlight && (
            <div className="flex gap-3 rounded-xl bg-success/10 p-4 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-success" />
              <div>
                <p className="font-semibold text-success">Por que vale a pena</p>
                <p className="text-foreground/80">{offer.suggestedHighlight}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <VoteButton offerId={offer.id} initialVotes={offer.upvotes ?? 0} size="lg" />
            <span className="text-sm text-muted-foreground">Essa oferta está boa? Esquente ela!</span>
          </div>
        </div>
      </div>

      {relatedOffers.length > 0 && (
        <section className="mt-10">
          <Separator className="mb-6" />
          <h2 className="mb-4 text-lg font-bold tracking-tight">Você também pode gostar</h2>
          <OfferGrid offers={relatedOffers} />
        </section>
      )}

      {/* CTA fixo no mobile — sempre ao alcance do polegar */}
      <div className="fixed inset-x-0 bottom-[var(--cookie-bar-h,0px)] z-30 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur transition-[bottom] duration-300 sm:hidden">
        <div className="flex items-center gap-3 pr-16">
          <div className="min-w-0">
            <p className="text-lg leading-none font-extrabold">{brl(offer.salePrice)}</p>
            {hasDiscount && <p className="text-xs font-semibold text-deal">-{offer.discountPct}% OFF</p>}
          </div>
          <div className="flex-1">{cta}</div>
        </div>
      </div>
    </main>
  )
}
