import Link from 'next/link'
import { ShoppingBag, Sparkles, Star } from 'lucide-react'
import { Offer } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { STORES, brl, cn, timeAgo } from '@/lib/utils'
import VoteButton from './VoteButton'
import CouponCopy from './CouponCopy'

// Mobile: card horizontal compacto (imagem à esquerda). sm+: card vertical em grade.
// O card inteiro é clicável (link "esticado"); voto e cupom ficam acima com z-10.
export default function OfferCard({ offer }: { offer: Offer }) {
  const store = STORES[offer.provider]
  const hasDiscount = offer.discountPct > 0 && offer.originalPrice > offer.salePrice

  return (
    <article className="group relative flex overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-col">
      <div className="relative w-28 shrink-0 bg-white sm:aspect-square sm:w-full">
        {offer.imageUrl ? (
          <img
            src={offer.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03] sm:p-4"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ShoppingBag className="size-8" />
          </div>
        )}
        {hasDiscount && (
          <Badge variant="deal" className="absolute top-2 left-2 rounded-md px-1.5 text-[11px] sm:text-xs">
            -{offer.discountPct}%
          </Badge>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-l p-3 sm:border-t sm:border-l-0 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {store && <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', store.className)}>{store.label}</span>}
          {!hasDiscount && (
            <Badge className="h-5 bg-violet-600 px-1.5 text-[10px]">
              <Sparkles /> Oferta especial
            </Badge>
          )}
          {offer.couponCode && <CouponCopy code={offer.couponCode} variant="badge" minValue={offer.couponMinValue} />}
        </div>

        <h3 className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground sm:text-sm">
          <Link href={`/oferta/${offer.id}`} className="after:absolute after:inset-0">
            {offer.title}
          </Link>
        </h3>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-extrabold tracking-tight sm:text-xl">{brl(offer.salePrice)}</span>
          {hasDiscount && <span className="text-xs text-muted-foreground line-through">{brl(offer.originalPrice)}</span>}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            {offer.rating ? (
              <span className="flex items-center gap-0.5">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {offer.rating.toFixed(1)}
              </span>
            ) : null}
            <span className="truncate">{timeAgo(offer.createdAt)}</span>
          </span>
          <VoteButton offerId={offer.id} initialVotes={offer.upvotes ?? 0} />
        </div>
      </div>
    </article>
  )
}
