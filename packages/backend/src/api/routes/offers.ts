import { Router } from 'express'
import { prisma } from '../../utils/prisma'
import { MercadoLivreProvider } from '../../providers/mercadolivre'
import { scrapeProductByUrl } from '../../providers/mercadolivre/scraper-product'
import { processOffer } from '../../jobs/offers.job'
import { sendPhoto, sendMessage } from '../../channels/telegram'

const router = Router()

router.get('/', async (req, res) => {
  const { provider, category, limit = '20', page = '1', minDiscount, sort } = req.query
  const take = Math.min(Number(limit), 100)
  const skip = (Number(page) - 1) * take

  const where: any = {
    ...(provider ? { provider: String(provider) } : {}),
    ...(category ? { category: String(category) } : {}),
    ...(minDiscount ? { discountPct: { gte: Number(minDiscount) } } : {}),
  }

  const orderBy: any = sort === 'discount'
    ? { discountPct: 'desc' }
    : sort === 'score'
      ? { aiScore: 'desc' }
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

router.post('/import', async (req, res) => {
  const {
    url,
    couponCode, couponDiscount, couponMinValue, couponMaxDiscount,
    manualTitle, manualSalePrice, manualOriginalPrice, manualImageUrl,
  } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Campo "url" obrigatório' })
  }

  const hasCoupon = !!couponCode
  const hasManualData = !!(manualTitle && manualSalePrice)

  const idMatch = url.match(/MLB-?(\d+)/)
  if (!idMatch) {
    return res.status(400).json({ error: 'URL inválida — ID MLB não encontrado na URL' })
  }
  const externalId = `MLB${idMatch[1]}`

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
  } else {
    try {
      console.log(`[Import] Scraping: ${url}`)
      raw = await scrapeProductByUrl(url)
    } catch (err) {
      console.error('[Import] Erro no scraping:', err)
      return res.status(400).json({ error: 'Não foi possível extrair dados do produto' })
    }
    if (!raw) {
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
      where: { code_provider: { code: couponCode.trim(), provider: 'mercadolivre' } },
      create: {
        provider: 'mercadolivre',
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

  const mlProvider = new MercadoLivreProvider()
  const source = hasCoupon ? 'coupon' : 'manual'

  try {
    await processOffer(
      raw, mlProvider,
      hasCoupon ? couponCode : undefined,
      source,
      discountText || undefined,
      minValueNum || undefined,
      maxDiscountNum,
      true, // admin import sempre posta, independente do score
    )
  } catch (err) {
    console.error('[Import] Erro ao processar oferta:', err)
    return res.status(500).json({ error: 'Erro ao processar oferta' })
  }

  const offer = await prisma.offer.findUnique({ where: { externalId }, include: { posts: true } })
  if (!offer) return res.status(500).json({ error: 'Erro interno após processamento' })

  let posted = false
  if (offer.telegramMessage) {
    try {
      const success = offer.imageUrl
        ? await sendPhoto(offer.imageUrl, offer.telegramMessage)
        : await sendMessage(offer.telegramMessage)
      await prisma.post.create({
        data: {
          offerId: offer.id,
          channel: 'telegram',
          message: offer.telegramMessage,
          whatsappMessage: offer.whatsappMessage,
          success,
        }
      })
      posted = success
      console.log(`[Import] ${success ? 'Postado' : 'Falha ao postar'}: "${offer.title}"`)
    } catch (err) {
      console.error('[Import] Erro ao postar no Telegram:', err)
    }
  } else {
    console.log(`[Import] Oferta salva mas sem copy (score IA baixo ou filtrada): "${offer.title}"`)
  }

  const finalOffer = await prisma.offer.findUnique({ where: { externalId }, include: { posts: true } })
  res.json({ offer: finalOffer, posted })
})

router.get('/:id', async (req, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
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
