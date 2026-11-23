import { prisma } from '../utils/prisma'
import { classifyCategory, isBook } from '../utils/category'
import { isHype, HYPE_MIN_DISCOUNT } from '../utils/hype'
import { AffiliateProvider } from '../providers/base.provider'
import { evaluateOffer, generatePostMessage, analyzeMarketValue, evaluateCouponOffer, generateCouponPostMessage, CouponContext, GeneratedPost } from '../ai'
import { publishOffer, postPriority, canPostNow, TELEGRAM_SOURCE_MAX_AGE_HOURS, ensureShortCode, shortLink, cleanTitle } from '../utils/publish'
import { Offer } from '@prisma/client'
import { scrapeHubProducts } from '../providers/mercadolivre/scraper-hub'
import { scrapeCouponsAndProducts } from '../providers/mercadolivre/scraper-coupons'
import { getAuthenticatedContext } from '../providers/mercadolivre/auth'
import { MercadoLivreProvider } from '../providers/mercadolivre'

const MIN_DISCOUNT = 20
const MIN_AI_SCORE = 6
const MAX_REPOSTS_PER_DAY = 2
const REPOST_INTERVAL_HOURS = 4

function shouldRepost(offer: Offer & { posts: { sentAt: Date; success: boolean }[] }): boolean {
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

function parseCouponDiscount(discountText: string): number {
  const match = discountText.replace(/\./g, '').replace(',', '.').match(/[\d]+(?:\.\d+)?/)
  return match ? parseFloat(match[0]) : 0
}

function calcCouponDiscount(salePrice: number, discountText: string, maxDiscount?: number): number {
  const num = parseCouponDiscount(discountText)
  const isPercent = discountText.includes('%')
  const raw = isPercent ? salePrice * (num / 100) : num
  return maxDiscount != null ? Math.min(raw, maxDiscount) : raw
}

export async function processOffer(
  raw: { externalId: string; title: string; originalPrice: number; salePrice: number; discountPct: number; imageUrl?: string; productUrl: string; rating?: number; couponAmount?: string; category?: string },
  provider: AffiliateProvider,
  couponCode?: string,
  source: string = 'offers-page',
  couponDiscount?: string,
  couponMinValue?: number,
  couponMaxDiscount?: number,
  forcePost: boolean = false,
  affiliateUrlOverride?: string
) {
  raw = { ...raw, title: cleanTitle(raw.title) }
  const tag = `[Job][${raw.externalId}][${source}]`
  if (isBook(raw.title, raw.externalId)) {
    console.log(`${tag} Livro — fora do catálogo, pulando`)
    return
  }
  const affiliateUrl = affiliateUrlOverride || provider.buildAffiliateLink(raw.productUrl)

  // Classifica categoria pelo título (prioriza valor explícito, exceto 'geral' que é só default)
  const category = (!raw.category || raw.category === 'geral')
    ? classifyCategory(raw.title)
    : raw.category

  // Verifica se já existe no banco com o mesmo preço
  const existingRaw = await prisma.offer.findUnique({ where: { externalId: raw.externalId } })
  if (existingRaw && existingRaw.salePrice === raw.salePrice) {
    // Backfill de categoria para ofertas já existentes sem classificação
    if (!existingRaw.category || existingRaw.category === 'geral') {
      await prisma.offer.update({ where: { externalId: raw.externalId }, data: { category } })
      console.log(`${tag} Categoria atualizada: ${category}`)
    }
    console.log(`${tag} Preço inalterado (R$${raw.salePrice}), pulando`)
    return
  }

  // Salva oferta bruta no banco (cria ou atualiza se preço mudou)
  await prisma.offer.upsert({
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
      category,
      rating: raw.rating,
      couponAmount: raw.couponAmount,
      couponCode: couponCode || null,
      source,
    },
    update: {
      salePrice: raw.salePrice,
      originalPrice: raw.originalPrice,
      discountPct: raw.discountPct,
      imageUrl: raw.imageUrl,
      rating: raw.rating,
      category,
      couponCode: couponCode || null,
      aiScore: null,
      telegramMessage: null,
      whatsappMessage: null,
    }
  })

  if (existingRaw) {
    console.log(`${tag} Preço atualizado R$${existingRaw.salePrice} → R$${raw.salePrice}: "${raw.title}"`)
  } else {
    console.log(`${tag} Salvo no banco: "${raw.title}" | R$${raw.salePrice} | ${raw.discountPct}% OFF${couponCode ? ` | cupom: ${couponCode}` : ''}`)
  }

  // Cupons e imports manuais bypassam filtro de desconto mínimo
  const isCoupon = source === 'coupon'
  const isManual = source === 'manual'
  // 'telegram' = oferta já garimpada por outro canal (preço revalidado); a IA decide
  // Hype (PS5, GTA, peça de PC) raramente cai 20%: aceita a partir de 8%
  const minDiscount = isHype(raw.title) ? HYPE_MIN_DISCOUNT : MIN_DISCOUNT
  if (!isCoupon && !isManual && source !== 'telegram' && raw.discountPct < minDiscount) {
    console.log(`${tag} Filtrado: desconto ${raw.discountPct}% abaixo do mínimo (${minDiscount}%)`)
    return
  }

  const existing = await prisma.offer.findUnique({
    where: { externalId: raw.externalId },
    include: { posts: { orderBy: { sentAt: 'desc' } } }
  })

  if (existing && existing.posts.length > 0) {
    console.log(`${tag} Filtrado: já tem post registrado`)
    return
  }

  // Monta contexto de cupom se disponível
  // minValue=0 significa sem mínimo (qualquer valor ativa o cupom)
  const effectiveMinValue = couponMinValue && couponMinValue > 0 ? couponMinValue : undefined
  const couponCtx: CouponContext | undefined = (isCoupon && couponCode && couponDiscount)
    ? (() => {
        const discountAmount = calcCouponDiscount(raw.salePrice, couponDiscount, couponMaxDiscount)
        const canApplyAlone = !effectiveMinValue || raw.salePrice >= effectiveMinValue
        const effectivePrice = canApplyAlone
          ? Math.max(0, raw.salePrice - discountAmount)
          : raw.salePrice
        return { code: couponCode, discount: couponDiscount, effectivePrice, minValue: effectiveMinValue, maxDiscount: couponMaxDiscount, canApplyAlone }
      })()
    : undefined

  if (couponCtx) {
    const minInfo = couponCtx.minValue ? ` | mínimo R$${couponCtx.minValue}` : ''
    const maxInfo = couponCtx.maxDiscount ? ` | teto R$${couponCtx.maxDiscount.toFixed(2)}` : ''
    const applyNote = couponCtx.canApplyAlone
      ? `preço efetivo R$${couponCtx.effectivePrice.toFixed(2)}`
      : `produto abaixo do mínimo — cupom ativa no carrinho`
    console.log(`${tag} Cupom: ${couponCtx.code} (${couponCtx.discount}) → ${applyNote}${minInfo}${maxInfo}`)
  }

  let evaluation
  try {
    evaluation = couponCtx
      ? await evaluateCouponOffer(raw, couponCtx)
      : await evaluateOffer(raw)
    const status = evaluation.score >= MIN_AI_SCORE ? 'APROVADO' : 'REPROVADO'
    console.log(`${tag} IA score: ${evaluation.score}/10 [${status}] — ${evaluation.reason}`)
  } catch (err) {
    console.error(`${tag} Erro na avaliação IA:`, err)
    return
  }

  await prisma.offer.update({
    where: { externalId: raw.externalId },
    data: { aiScore: evaluation.score }
  })

  if (!forcePost && (!evaluation.shouldPost || evaluation.score < MIN_AI_SCORE)) return

  let marketAnalysis
  try {
    marketAnalysis = await analyzeMarketValue(raw)
    console.log(`${tag} Análise de mercado: ${marketAnalysis.suggestedHighlight || 'sem destaque'}`)
  } catch {
    marketAnalysis = { isCompetitive: true, reason: '', suggestedHighlight: '' }
  }

  let generated
  try {
    // copy já sai com o link curto do site (/r/{code}), não com o link de afiliado cheio
    const postUrl = shortLink(await ensureShortCode(raw.externalId))
    generated = couponCtx
      ? await generateCouponPostMessage(raw, postUrl, couponCtx, marketAnalysis.suggestedHighlight)
      : await generatePostMessage(raw, postUrl, couponCode, marketAnalysis.suggestedHighlight)
  } catch (err) {
    console.error(`${tag} Erro ao gerar copy:`, err)
    return
  }

  await prisma.offer.update({
    where: { externalId: raw.externalId },
    data: {
      suggestedHighlight: marketAnalysis.suggestedHighlight || null,
      telegramMessage: generated.telegram,
      whatsappMessage: generated.whatsapp,
    }
  })

  console.log(`${tag} ✓ Copy gerado — pronto para posting`)
}

export async function runOffersJob(provider: AffiliateProvider) {
  console.log(`[Job] Iniciando job de ofertas: ${provider.name}`)

  let rawOffers: any[] = []

  try {
    rawOffers = await provider.scrapeOffers()
  } catch (err) {
    console.error('[Job] Erro no scraping:', err)
    return
  }

  console.log(`[Job] ${rawOffers.length} ofertas coletadas`)

  for (const raw of rawOffers) {
    try {
      await processOffer(raw, provider, undefined, 'offers-page')
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
      c.products.map(p => ({ ...p, couponCode: c.code, couponDiscount: c.discount, couponMinValue: c.minValue }))
    )

    console.log(`\n[Job] Processando ${hubProducts.length} produtos do hub...`)
    for (const raw of hubProducts) {
      try {
        await processOffer(raw, mlProvider, undefined, 'hub')
      } catch (err) {
        console.error(`[Job] Erro hub oferta ${raw.externalId}:`, err)
      }
    }

    console.log(`\n[Job] Processando ${allCouponProducts.length} produtos de cupons...`)
    for (const raw of allCouponProducts) {
      try {
        await processOffer(raw, mlProvider, raw.couponCode, 'coupon', raw.couponDiscount, raw.couponMinValue)
      } catch (err) {
        console.error(`[Job] Erro coupon oferta ${raw.externalId}:`, err)
      }
    }

    // Resumo final
    const [totalOffers, readyToPost, hubCount, couponCount] = await Promise.all([
      prisma.offer.count(),
      prisma.offer.count({ where: { telegramMessage: { not: null }, aiScore: { gte: MIN_AI_SCORE }, posts: { none: { channel: 'telegram' } } } }),
      prisma.offer.count({ where: { source: 'hub' } }),
      prisma.offer.count({ where: { source: 'coupon' } }),
    ])
    console.log(`\n[Job] === RESUMO ===`)
    console.log(`[Job] Total no banco: ${totalOffers} ofertas (hub: ${hubCount}, cupom: ${couponCount})`)
    console.log(`[Job] Prontas para posting: ${readyToPost}`)
  } finally {
    await ctx.browser()?.close()
  }

  console.log('[Job] Hub job concluído')
}

// Posting único: a MESMA oferta vai para Telegram e WhatsApp (link curto do site).
// Só ofertas com imagem e recentes; fila ordenada por nota da IA + bônus de ticket baixo.
export async function runPostingJob(maxPosts = 1, force = false) {
  // Fora do horário (POST_HOURS) só saem ofertas dos canais do Telegram: se eles
  // postam de madrugada, a gente acompanha.
  const offHours = !force && !canPostNow()
  if (!offHours) console.log(`[Job] Iniciando job de posting (máx ${maxPosts} posts)`)

  const maxAgeHours = parseInt(process.env.POST_MAX_AGE_HOURS || '72', 10)
  const candidates = await prisma.offer.findMany({
    where: {
      telegramMessage: { not: null },
      imageUrl: { not: null },
      aiScore: { gte: MIN_AI_SCORE },
      createdAt: { gte: new Date(Date.now() - maxAgeHours * 3600000) },
      posts: { none: {} },
      ...(offHours ? { source: 'telegram' } : {}),
    },
    take: 300,
  })
  if (offHours && candidates.length === 0) return
  // Variedade: penaliza categoria/loja/tipo que saíram nos últimos posts (evita 7 livros seguidos)
  const recent = await prisma.post.findMany({ where: { channel: 'telegram' }, orderBy: { sentAt: 'desc' }, take: 4, include: { offer: { select: { category: true, provider: true, title: true } } } })
  const kind = (t: string) => (t.match(/^\S+/)?.[0] || '').toLowerCase()
  const pending: typeof candidates = []
  // Oferta dos canais do Telegram com mais de 6h provavelmente já acabou
  const tgCutoff = Date.now() - TELEGRAM_SOURCE_MAX_AGE_HOURS * 3600000
  const pool = candidates.filter(o => o.source !== 'telegram' || o.createdAt.getTime() >= tgCutoff)
  const seen = recent.map(p => p.offer)
  while (pending.length < maxPosts && pool.length) {
    const score = (o: typeof candidates[number]) => postPriority(o)
      - 1.5 * seen.filter(r => r.category === o.category).length
      - 0.5 * seen.filter(r => r.provider === o.provider).length
      - 1 * seen.filter(r => kind(r.title) === kind(o.title)).length
    pool.sort((a, b) => score(b) - score(a))
    const next = pool.shift()!
    pending.push(next)
    seen.unshift(next)
  }

  console.log(`[Job] ${candidates.length} ofertas na fila, postando ${pending.length}`)

  for (const offer of pending) {
    try {
      await publishOffer(offer)
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.error(`[Job] Erro ao postar ${offer.id}:`, err)
    }
  }

  console.log('[Job] Posting job concluído')
}

export async function runRepostJob() {
  console.log('[Job] Iniciando job de repost')
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const offers = await prisma.offer.findMany({
    where: {
      posts: { some: { channel: 'telegram', sentAt: { gte: todayStart }, success: true } }
    },
    include: { posts: { where: { channel: 'telegram' }, orderBy: { sentAt: 'desc' } } }
  })

  const maxReposts = parseInt(process.env.REPOST_MAX || '3', 10)
  const eligible = offers.filter(shouldRepost).sort((a, b) => postPriority(b) - postPriority(a)).slice(0, maxReposts)
  console.log(`[Job] Repost: ${eligible.length} de ${offers.length} ofertas de hoje`)

  for (const offer of eligible) {
    try {

      const rawOffer = { externalId: offer.externalId, title: offer.title, originalPrice: offer.originalPrice, salePrice: offer.salePrice, discountPct: offer.discountPct, imageUrl: offer.imageUrl || undefined, productUrl: offer.productUrl, rating: offer.rating || undefined }
      let generated: GeneratedPost

      if (offer.source === 'coupon' && offer.couponCode) {
        const coupon = await prisma.coupon.findFirst({ where: { code: offer.couponCode, provider: offer.provider } })
        if (coupon) {
          const discountAmount = calcCouponDiscount(offer.salePrice, coupon.discount, coupon.maxDiscount ?? undefined)
          const effectiveMinValue = coupon.minValue && coupon.minValue > 0 ? coupon.minValue : undefined
          const canApplyAlone = !effectiveMinValue || offer.salePrice >= effectiveMinValue
          const effectivePrice = canApplyAlone ? Math.max(0, offer.salePrice - discountAmount) : offer.salePrice
          const couponCtx: CouponContext = { code: coupon.code, discount: coupon.discount, effectivePrice, minValue: effectiveMinValue, maxDiscount: coupon.maxDiscount ?? undefined, canApplyAlone }
          generated = await generateCouponPostMessage(rawOffer, offer.affiliateUrl, couponCtx, offer.suggestedHighlight || undefined)
        } else {
          generated = await generatePostMessage(rawOffer, offer.affiliateUrl, offer.couponCode, offer.suggestedHighlight || undefined)
        }
      } else {
        generated = await generatePostMessage(rawOffer, offer.affiliateUrl, offer.couponCode || undefined, offer.suggestedHighlight || undefined)
      }

      await publishOffer(offer, { telegramText: generated.telegram, whatsappText: generated.whatsapp, repost: true })

      console.log(`[Job] Repostado: "${offer.title}"`)
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.error(`[Job] Erro ao repostar ${offer.id}:`, err)
    }
  }

  console.log('[Job] Repost job concluído')
}
