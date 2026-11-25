import { Router } from 'express'
import { requireAdminSecret } from './admin'
import { prisma } from '../../utils/prisma'
import { resolveProviderByUrl, PROVIDER_LABELS } from '../../providers/registry'
import { processOffer } from '../../jobs/offers.job'
import { publishOffer } from '../../utils/publish'
import { mlRecentlyBlocked } from '../../providers/mercadolivre/browser'

const router = Router()

router.get('/', async (req, res) => {
  const { provider, category, limit = '20', page = '1', minDiscount, sort, q } = req.query
  const take = Math.min(Number(limit), 100)
  const skip = (Number(page) - 1) * take

  const where: any = {
    ...(provider ? { provider: String(provider) } : {}),
    ...(category ? { category: String(category) } : {}),
    ...(minDiscount ? { discountPct: { gte: Number(minDiscount) } } : {}),
    ...(q ? { title: { contains: String(q), mode: 'insensitive' } } : {}),
  }

  const orderBy: any = sort === 'discount'
    ? { discountPct: 'desc' }
    : sort === 'score'
      // Sem "nulls last" o Postgres põe as NÃO avaliadas (aiScore null) no topo do "IA Score"
      ? [{ aiScore: { sort: 'desc', nulls: 'last' } }, { discountPct: 'desc' }, { createdAt: 'desc' }]
      : sort === 'votes'
        ? { upvotes: 'desc' }
        : { createdAt: 'desc' }

  const [offers, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      orderBy,
      take,
      skip,
      include: { posts: { orderBy: { sentAt: 'desc' }, take: 1 } }
    }),
    prisma.offer.count({ where })
  ])

  const couponCodes = [...new Set(offers.filter(o => o.couponCode).map(o => o.couponCode!))]
  const coupons = couponCodes.length > 0
    ? await prisma.coupon.findMany({ where: { code: { in: couponCodes } } })
    : []
  const couponMinMap = new Map(coupons.map(c => [c.code, c.minValue]))

  const offersWithMin = offers.map(o => ({
    ...o,
    couponMinValue: o.couponCode ? (couponMinMap.get(o.couponCode) ?? null) : null,
  }))

  res.json({ offers: offersWithMin, total, page: Number(page), limit: take })
})

// Import posta direto nos canais: só com o ADMIN_SECRET (via proxy /api/admin/import do site)
router.post('/import', requireAdminSecret, async (req, res) => {
  let {
    url,
  } = req.body
  const {
    affiliateShortLink,
    couponCode, couponDiscount, couponMinValue, couponMaxDiscount,
    manualTitle, manualSalePrice, manualOriginalPrice, manualImageUrl,
  } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Campo "url" obrigatório' })
  }

  const hasCoupon = !!couponCode
  const hasManualData = !!(manualTitle && manualSalePrice)

  // Link curto (meli.la, amzn.to, s.shopee…): segue até a loja. O meli.la cai no perfil
  // "social" do afiliado — o produto vem pronto do card (mesmo resolvedor das fontes)
  let resolved = resolveProviderByUrl(url)
  let presolved: any = null
  if (!resolved && !hasManualData) {
    try {
      const { resolveProduct } = await import('../../jobs/telegram-source')
      const r = await resolveProduct(url)
      if (r) {
        resolved = resolveProviderByUrl(r.url)
        presolved = r.raw ?? null
        if (resolved) {
          console.log(`[Import] Link curto ${url} → ${r.url}`)
          url = r.url
        }
      }
    } catch (err: any) {
      console.warn(`[Import] Falha ao seguir link curto ${url}: ${err?.message}`)
    }
  }
  if (!resolved) {
    return res.status(400).json({
      error: 'URL não reconhecida. Plataformas suportadas: Mercado Livre, Amazon, Shopee, KaBuM!, AliExpress e Stanley.',
    })
  }
  const { provider, externalId, scrapeProduct } = resolved
  const providerLabel = PROVIDER_LABELS[provider.name] || provider.name
  console.log(`[Import] Provider detectado: ${providerLabel} (${externalId})`)

  const existing = await prisma.offer.findUnique({ where: { externalId } })
  if (existing) {
    return res.status(409).json({ error: 'Oferta já existe no banco', offer: existing })
  }

  let raw: any

  if (hasManualData) {
    const salePriceNum = Number(manualSalePrice)
    const originalPriceNum = manualOriginalPrice ? Number(manualOriginalPrice) : salePriceNum
    const discountPctNum = originalPriceNum > salePriceNum
      ? Math.round((1 - salePriceNum / originalPriceNum) * 100)
      : 0
    const cleanUrl = url.split('#')[0].split('?')[0]
    raw = {
      externalId,
      title: String(manualTitle).trim(),
      salePrice: salePriceNum,
      originalPrice: originalPriceNum,
      discountPct: discountPctNum,
      productUrl: cleanUrl,
      imageUrl: manualImageUrl ? String(manualImageUrl).trim() : undefined,
    }
    console.log(`[Import] Dados manuais: "${raw.title}" R$${raw.salePrice} (${raw.discountPct}% OFF)`)
  } else if (presolved) {
    raw = presolved
    console.log(`[Import] Dados do link curto: "${raw.title}" R$${raw.salePrice} (${raw.discountPct}% OFF)`)
  } else {
    try {
      console.log(`[Import] Scraping (${providerLabel}): ${url}`)
      raw = await scrapeProduct(url)
    } catch (err) {
      console.error('[Import] Erro no scraping:', err)
      return res.status(400).json({ error: 'Não foi possível extrair dados do produto' })
    }
    if (!raw) {
      if (provider.name === 'mercadolivre' && mlRecentlyBlocked()) {
        return res.status(400).json({ error: 'O Mercado Livre pediu verificação (captcha). No PC, rode "npm run ml:login" e resolva na janela — ou use a opção de inserir dados manualmente.' })
      }
      return res.status(400).json({ error: 'Produto não encontrado ou sem dados de preço. Use a opção de inserir dados manualmente.' })
    }
  }

  // minValue=0 significa sem mínimo; undefined também = sem mínimo
  const minValueNum = (couponMinValue != null && couponMinValue !== '') ? Number(couponMinValue) : 0
  const maxDiscountNum = (couponMaxDiscount != null && couponMaxDiscount !== '') ? Number(couponMaxDiscount) : undefined
  const discountText = couponDiscount ? String(couponDiscount).trim() : ''

  // Persiste o cupom no banco para o frontend mostrar os detalhes
  if (hasCoupon) {
    await prisma.coupon.upsert({
      where: { code_provider: { code: couponCode.trim(), provider: provider.name } },
      create: {
        provider: provider.name,
        code: couponCode.trim(),
        discount: discountText,
        minValue: minValueNum > 0 ? minValueNum : null,
        maxDiscount: maxDiscountNum ?? null,
      },
      update: {
        discount: discountText || undefined,
        minValue: minValueNum > 0 ? minValueNum : null,
        maxDiscount: maxDiscountNum ?? null,
      },
    })
  }

  const source = hasCoupon ? 'coupon' : 'manual'

  // Link de afiliado colado no form (opcional): tem precedência sobre o gerado.
  // Shopee gera sozinho via SHOPEE_AFFILIATE_ID (ver providers/shopee).
  const affiliateOverride = (affiliateShortLink && typeof affiliateShortLink === 'string' && affiliateShortLink.trim())
    ? affiliateShortLink.trim()
    : undefined

  try {
    await processOffer(
      raw, provider,
      hasCoupon ? couponCode : undefined,
      source,
      discountText || undefined,
      minValueNum || undefined,
      maxDiscountNum,
      true, // admin import sempre posta, independente do score
      affiliateOverride,
    )
  } catch (err) {
    console.error('[Import] Erro ao processar oferta:', err)
    return res.status(500).json({ error: 'Erro ao processar oferta' })
  }

  const offer = await prisma.offer.findUnique({ where: { externalId }, include: { posts: true } })
  if (!offer) return res.status(500).json({ error: 'Erro interno após processamento' })

  // preview: true (painel /admin/import) → só salva e gera o texto; o admin confere a
  // prévia e posta pelo botão (POST /api/admin/offers/:id/send)
  if (req.body?.preview === true) {
    console.log(`[Import] Prévia pronta (sem postar): "${offer.title}"`)
    return res.json({ offer, posted: false, preview: true })
  }

  let posted = false
  if (offer.telegramMessage) {
    try {
      // mesma publicação do posting agendado: Telegram + WhatsApp com link curto
      posted = (await publishOffer(offer)).telegram
    } catch (err) {
      console.error('[Import] Erro ao postar:', err)
    }
  } else {
    console.log(`[Import] Oferta salva mas sem copy (score IA baixo ou filtrada): "${offer.title}"`)
  }

  const finalOffer = await prisma.offer.findUnique({ where: { externalId }, include: { posts: true } })
  res.json({ offer: finalOffer, posted })
})

// Link curto do site (/r/{code}): devolve o destino de afiliado e conta o clique.
// count=0 quando quem pede é robô de prévia (Telegram/WhatsApp/Facebook)
router.get('/go/:code', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { shortCode: req.params.code }, select: { id: true, affiliateUrl: true, provider: true } })
  if (!offer) return res.status(404).json({ error: 'Link não encontrado' })
  if (req.query.count !== '0') {
    // src: t (Telegram), w (Tech & TCG), a (Achadinhos), i (Instagram/links) — sem = site
    const src = /^[twai]$/.test(String(req.query.src || '')) ? String(req.query.src) : null
    await Promise.all([
      prisma.offer.update({ where: { id: offer.id }, data: { clicks: { increment: 1 } } }),
      prisma.click.create({ data: { offerId: offer.id, provider: offer.provider, src } }),
    ]).catch(() => {})
  }
  res.set('Cache-Control', 'no-store').json({ id: offer.id, url: offer.affiliateUrl })
})

router.get('/:id', async (req, res) => {
  // Aceita o id ou o código do link curto (/r/CODE) — usado pelo "story de um link" do admin
  const offer = await prisma.offer.findFirst({
    where: { OR: [{ id: req.params.id }, { shortCode: req.params.id }] },
    include: { posts: true }
  })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })

  let couponMinValue: number | null = null
  if (offer.couponCode) {
    const coupon = await prisma.coupon.findFirst({ where: { code: offer.couponCode } })
    couponMinValue = coupon?.minValue ?? null
  }

  res.json({ ...offer, couponMinValue })
})

router.post('/:id/vote', async (req, res) => {
  try {
    const offer = await prisma.offer.update({
      where: { id: String(req.params.id) },
      data: { upvotes: { increment: 1 } },
    })
    res.json({ upvotes: offer.upvotes })
  } catch {
    res.status(404).json({ error: 'Oferta não encontrada' })
  }
})

router.post('/:id/downvote', async (req, res) => {
  try {
    const offer = await prisma.offer.update({
      where: { id: String(req.params.id) },
      data: { upvotes: { decrement: 1 } },
    })
    res.json({ upvotes: offer.upvotes })
  } catch {
    res.status(404).json({ error: 'Oferta não encontrada' })
  }
})

export default router
