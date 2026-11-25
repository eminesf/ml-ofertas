import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { publishOffer, ensureShortCode, shortLink } from '../../utils/publish'
import { offerGroup } from '../../utils/groups'
import { isFresh } from '../../utils/freshness'
import { resolveProviderByUrl } from '../../providers/registry'
import { generatePostMessage } from '../../ai'

// /admin/ofertas — gerenciar uma oferta já no banco: buscar, corrigir (link/cor, preço,
// foto, texto), gerar o texto de novo, postar de novo e apagar. Montado em /api/admin/offers
// (atrás do requireAdminSecret do admin.ts).
const router = Router()

const LIST_SELECT = {
  id: true, externalId: true, title: true, provider: true, source: true, category: true,
  imageUrl: true, productUrl: true, salePrice: true, originalPrice: true, discountPct: true,
  aiScore: true, couponCode: true, shortCode: true, clicks: true, createdAt: true, priceSeenAt: true,
  telegramMessage: true,
  posts: { select: { channel: true, sentAt: true }, orderBy: { sentAt: 'desc' as const }, take: 6 },
}

function withMeta<T extends { posts: { channel: string; sentAt: Date }[] } & Record<string, any>>(o: T) {
  const { telegramMessage, ...rest } = o
  return { ...rest, hasCopy: !!telegramMessage, group: offerGroup(o as any), fresh: isFresh(o as any) }
}

// GET /api/admin/offers?q= — busca por nome (todas as palavras), link do produto,
// link curto (/r/CODE ou só o código), externalId (MLB…, NIKE-…) ou id
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim()
  let where: Prisma.OfferWhereInput = {}
  if (q) {
    const code = q.match(/\/r\/([A-Za-z0-9]+)/)?.[1]
    const nikeId = q.match(/nike\.com\.br\/.*-(\d{5,})\.html/)?.[1]
    const mlb = q.match(/MLB-?(\d{6,})/i)?.[1]
    const asin = q.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})/)?.[1]
    if (code) where = { shortCode: code }
    else if (nikeId) where = { externalId: `NIKE-${nikeId}` }
    else if (mlb) where = { externalId: `MLB${mlb}` }
    else if (asin) where = { externalId: `AMZN-${asin}` }
    else if (/^https?:\/\//.test(q)) where = { productUrl: { contains: q.split('?')[0].split('#')[0], mode: 'insensitive' } }
    else {
      const words = q.split(/\s+/).filter(w => w.length > 1)
      where = {
        OR: [
          { id: q }, { externalId: { equals: q, mode: 'insensitive' } }, { shortCode: q },
          { AND: words.map(w => ({ title: { contains: w, mode: 'insensitive' as const } })) },
        ],
      }
    }
  }
  const offers = await prisma.offer.findMany({ where, select: LIST_SELECT, orderBy: { createdAt: 'desc' }, take: 40 })
  res.json({ offers: offers.map(withMeta) })
})

// GET /api/admin/offers/:id — oferta completa (com os textos)
router.get('/:id', async (req, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { posts: { select: { channel: true, sentAt: true, price: true, couponCode: true }, orderBy: { sentAt: 'desc' } } },
  })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  res.json({ offer: { ...offer, group: offerGroup(offer), fresh: isFresh(offer) } })
})

// PATCH /api/admin/offers/:id — corrige campos. Trocar o link (ex.: outra cor da Nike)
// refaz o link de afiliado; tem de ser o MESMO produto (mesmo externalId).
router.patch('/:id', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  const b = req.body || {}
  const data: Prisma.OfferUpdateInput = {}
  const num = (v: any) => (v === '' || v == null ? undefined : Number(String(v).replace(',', '.')))

  if (typeof b.title === 'string' && b.title.trim()) data.title = b.title.trim()
  if (typeof b.imageUrl === 'string') data.imageUrl = b.imageUrl.trim() || null
  if (typeof b.category === 'string' && b.category) data.category = b.category
  if ('couponCode' in b) data.couponCode = String(b.couponCode || '').trim() || null
  if (typeof b.telegramMessage === 'string') data.telegramMessage = b.telegramMessage.trim() || null
  if (typeof b.whatsappMessage === 'string') data.whatsappMessage = b.whatsappMessage.trim() || null

  const sale = num(b.salePrice), orig = num(b.originalPrice)
  if (sale != null && !(sale > 0)) return res.status(400).json({ error: 'Preço inválido' })
  if (orig != null && !(orig > 0)) return res.status(400).json({ error: 'Preço "de" inválido' })
  if (sale != null || orig != null) {
    const s = sale ?? offer.salePrice
    const o = Math.max(orig ?? offer.originalPrice, s)
    Object.assign(data, { salePrice: s, originalPrice: o, discountPct: o > s ? Math.round((1 - s / o) * 100) : 0, priceSeenAt: new Date() })
  }

  if (typeof b.productUrl === 'string' && b.productUrl.trim() && b.productUrl.trim() !== offer.productUrl) {
    const url = b.productUrl.trim()
    const resolved = resolveProviderByUrl(url)
    if (!resolved) return res.status(400).json({ error: 'Link não reconhecido' })
    if (resolved.externalId !== offer.externalId) {
      return res.status(400).json({ error: `Esse link é de outro produto (${resolved.externalId}). Para outro produto, use "Importar oferta".` })
    }
    data.productUrl = url
    data.affiliateUrl = resolved.provider.buildAffiliateLink(url)
  }

  const updated = await prisma.offer.update({ where: { id: offer.id }, data })
  console.log(`[AdminOffers] "${updated.title.slice(0, 50)}" editada: ${Object.keys(data).join(', ')}`)
  res.json({ offer: updated })
})

// POST /api/admin/offers/:id/regenerate — { note? } gera o texto de novo com a IA usando os
// dados atuais (preço, cupom, link curto); "note" é uma instrução extra (ex.: "no Pix R$329")
router.post('/:id/regenerate', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  try {
    const raw = {
      externalId: offer.externalId, title: offer.title, originalPrice: offer.originalPrice, salePrice: offer.salePrice,
      discountPct: offer.discountPct, imageUrl: offer.imageUrl ?? undefined, productUrl: offer.productUrl,
      rating: offer.rating ?? undefined, category: offer.category ?? undefined,
      sourceNote: String(req.body?.note || '').trim() || undefined,
    }
    const postUrl = shortLink(await ensureShortCode(offer.externalId))
    const gen = await generatePostMessage(raw as any, postUrl, offer.couponCode ?? undefined, offer.suggestedHighlight ?? undefined)
    const updated = await prisma.offer.update({ where: { id: offer.id }, data: { telegramMessage: gen.telegram, whatsappMessage: gen.whatsapp } })
    res.json({ offer: updated })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao gerar texto' })
  }
})

// POST /api/admin/offers/:id/send?repost=1 — posta já (Telegram + grupo); repost=1 posta de novo
router.post('/:id/send', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  if (!offer.telegramMessage) return res.status(409).json({ error: 'Oferta sem texto — gere o texto antes' })
  try {
    const result = await publishOffer(offer, { repost: req.query.repost === '1' })
    if (!result.telegram && result.whatsapp === null) return res.status(409).json({ error: 'Já foi postada (use "Postar de novo")', ...result })
    res.json({ sent: true, ...result })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao enviar' })
  }
})

// DELETE /api/admin/offers/:id — apaga a oferta e o histórico de posts (cliques ficam
// na tabela Click, para a análise). O link curto /r/ dela para de funcionar.
router.delete('/:id', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  await prisma.$transaction([
    prisma.post.deleteMany({ where: { offerId: offer.id } }),
    prisma.offer.delete({ where: { id: offer.id } }),
  ])
  console.log(`[AdminOffers] apagada: "${offer.title.slice(0, 60)}" (${offer.externalId})`)
  res.json({ deleted: true, externalId: offer.externalId })
})

export default router
