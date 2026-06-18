import { prisma } from '../utils/prisma'
import { AffiliateProvider } from '../providers/base.provider'
import { evaluateOffer, generatePostMessage, analyzeMarketValue } from '../ai'
import { sendPhoto, sendMessage } from '../channels/telegram'
import { Offer } from '@prisma/client'
import { scrapeHubProducts } from '../providers/mercadolivre/scraper-hub'
import { scrapeCouponsAndProducts } from '../providers/mercadolivre/scraper-coupons'
import { getAuthenticatedContext } from '../providers/mercadolivre/auth'
import { MercadoLivreProvider } from '../providers/mercadolivre'

const MIN_DISCOUNT = 20
const MIN_AI_SCORE = 6
const MAX_REPOSTS_PER_DAY = 2
const REPOST_INTERVAL_HOURS = 4

export function shouldRepost(offer: Offer & { posts: { sentAt: Date; success: boolean }[] }): boolean {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Verifica se cupom venceu
  if (offer.couponExpiresAt && offer.couponExpiresAt < now) return false

  const todayPosts = offer.posts.filter(p => p.sentAt >= todayStart && p.success)

  // Já postou o máximo permitido hoje
  if (todayPosts.length >= MAX_REPOSTS_PER_DAY) return false

  // Último post foi há menos de 4 horas
  if (todayPosts.length > 0) {
    const lastPost = todayPosts.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0]
    const hoursSinceLastPost = (now.getTime() - lastPost.sentAt.getTime()) / 3600000
    if (hoursSinceLastPost < REPOST_INTERVAL_HOURS) return false
  }

  return true
}

async function processOffer(
  raw: { externalId: string; title: string; originalPrice: number; salePrice: number; discountPct: number; imageUrl?: string; productUrl: string; rating?: number; couponAmount?: string; category?: string },
  provider: AffiliateProvider,
  couponCode?: string,
  source: string = 'offers-page'
) {
  if (raw.discountPct < MIN_DISCOUNT) return

  const existing = await prisma.offer.findUnique({
    where: { externalId: raw.externalId },
    include: { posts: { orderBy: { sentAt: 'desc' } } }
  })

  if (existing && existing.posts.length > 0) {
    console.log(`[Job] Já postado: ${raw.externalId}`)
    return
  }

  let evaluation
  try {
    evaluation = await evaluateOffer(raw)
    console.log(`[Job] Score IA "${raw.title}": ${evaluation.score} — ${evaluation.reason}`)
  } catch (err) {
    console.error('[Job] Erro na avaliação IA:', err)
    return
  }

  if (!evaluation.shouldPost || evaluation.score < MIN_AI_SCORE) return

  let marketAnalysis
  try {
    marketAnalysis = await analyzeMarketValue(raw)
  } catch {
    marketAnalysis = { isCompetitive: true, reason: '', suggestedHighlight: '' }
  }

  const affiliateUrl = provider.buildAffiliateLink(raw.productUrl)

  let generated
  try {
    generated = await generatePostMessage(raw, affiliateUrl, couponCode, marketAnalysis.suggestedHighlight)
  } catch (err) {
    console.error('[Job] Erro ao gerar copy:', err)
    return
  }

  const offer = await prisma.offer.upsert({
    where: { externalId: raw.externalId },
    create: {
      externalId: raw.externalId,
      provider: provider.name,
      title: raw.title,
      originalPrice: raw.originalPrice,
      salePrice: raw.salePrice,
      discountPct: raw.discountPct,
      imageUrl: raw.imageUrl,
      productUrl: raw.productUrl,
      affiliateUrl,
      category: raw.category,
      rating: raw.rating,
      aiScore: evaluation.score,
      couponAmount: raw.couponAmount,
      couponCode: couponCode || null,
      suggestedHighlight: marketAnalysis.suggestedHighlight || null,
      telegramMessage: generated.telegram,
      whatsappMessage: generated.whatsapp,
      source,
    },
    update: {
      aiScore: evaluation.score,
      telegramMessage: generated.telegram,
      whatsappMessage: generated.whatsapp,
      suggestedHighlight: marketAnalysis.suggestedHighlight || null,
    }
  })

  const success = raw.imageUrl
    ? await sendPhoto(raw.imageUrl, generated.telegram)
    : await sendMessage(generated.telegram)

  await prisma.post.create({
    data: {
      offerId: offer.id,
      channel: 'telegram',
      message: generated.telegram,
      whatsappMessage: generated.whatsapp,
      success
    }
  })

  console.log(`[Job] Postado: "${raw.title}" (score: ${evaluation.score})`)
  await new Promise(r => setTimeout(r, 2000))
}

export async function runOffersJob(provider: AffiliateProvider) {
  console.log(`[Job] Iniciando job de ofertas: ${provider.name}`)

  let rawOffers: any[] = []
  let rawCoupons: any[] = []

  try {
    [rawOffers, rawCoupons] = await Promise.all([
      provider.scrapeOffers(),
      provider.scrapeCoupons()
    ])
  } catch (err) {
    console.error('[Job] Erro no scraping:', err)
    return
  }

  console.log(`[Job] ${rawOffers.length} ofertas coletadas`)

  for (const raw of rawOffers) {
    try {
      const coupon = rawCoupons.find((c: any) => !c.category || c.category === raw.category)
      await processOffer(raw, provider, coupon?.code, 'offers-page')
    } catch (err) {
      console.error(`[Job] Erro ao processar oferta ${raw.externalId}:`, err)
    }
  }

  console.log(`[Job] Concluído: ${provider.name}`)
}

export async function runHubJob(providers: AffiliateProvider[]) {
  console.log('[Job] Iniciando job do hub de afiliados')
  const mlProvider = providers.find(p => p.name === 'mercadolivre') as MercadoLivreProvider | undefined
  if (!mlProvider) return

  let ctx: any
  try {
    ctx = await getAuthenticatedContext()
  } catch (err) {
    console.error('[Job] Erro ao autenticar no ML:', err)
    return
  }

  try {
    const hubProducts = await scrapeHubProducts(ctx, (url) => mlProvider.buildAffiliateLink(url))
    const couponData = await scrapeCouponsAndProducts(ctx, (url) => mlProvider.buildAffiliateLink(url))

    const allCouponProducts = couponData.flatMap(c =>
      c.products.map(p => ({ ...p, couponCode: c.code }))
    )

    for (const raw of hubProducts) {
      try {
        await processOffer(raw, mlProvider, undefined, 'hub')
      } catch (err) {
        console.error(`[Job] Erro hub oferta ${raw.externalId}:`, err)
      }
    }

    for (const raw of allCouponProducts) {
      try {
        await processOffer(raw, mlProvider, raw.couponCode, 'coupon')
      } catch (err) {
        console.error(`[Job] Erro coupon oferta ${raw.externalId}:`, err)
      }
    }
  } finally {
    await ctx.browser()?.close()
  }

  console.log('[Job] Hub job concluído')
}

export async function runRepostJob() {
  console.log('[Job] Iniciando job de repost')
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const offers = await prisma.offer.findMany({
    where: {
      posts: { some: { sentAt: { gte: todayStart }, success: true } }
    },
    include: { posts: { orderBy: { sentAt: 'desc' } } }
  })

  for (const offer of offers) {
    try {
      if (!shouldRepost(offer)) continue

      const generated = await generatePostMessage(
        { externalId: offer.externalId, title: offer.title, originalPrice: offer.originalPrice, salePrice: offer.salePrice, discountPct: offer.discountPct, imageUrl: offer.imageUrl || undefined, productUrl: offer.productUrl, rating: offer.rating || undefined },
        offer.affiliateUrl,
        offer.couponCode || undefined,
        offer.suggestedHighlight || undefined
      )

      const success = offer.imageUrl
        ? await sendPhoto(offer.imageUrl, generated.telegram)
        : await sendMessage(generated.telegram)

      await prisma.post.create({
        data: {
          offerId: offer.id,
          channel: 'telegram',
          message: generated.telegram,
          whatsappMessage: generated.whatsapp,
          repostedAt: new Date(),
          success
        }
      })

      console.log(`[Job] Repostado: "${offer.title}"`)
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.error(`[Job] Erro ao repostar ${offer.id}:`, err)
    }
  }

  console.log('[Job] Repost job concluído')
}
