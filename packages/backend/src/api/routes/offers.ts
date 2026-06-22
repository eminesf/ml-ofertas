import { Router } from 'express'
import { prisma } from '../../utils/prisma'

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

  res.json({ offers, total, page: Number(page), limit: take })
})

router.get('/:id', async (req, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { posts: true }
  })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  res.json(offer)
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
