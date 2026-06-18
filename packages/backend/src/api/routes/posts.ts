import { Router } from 'express'
import { prisma } from '../../utils/prisma'

const router = Router()

// GET /api/posts — histórico de posts enviados
router.get('/', async (req, res) => {
  const { channel, limit = '20', page = '1' } = req.query
  const take = Number(limit)
  const skip = (Number(page) - 1) * take

  const posts = await prisma.post.findMany({
    where: channel ? { channel: String(channel) } : {},
    orderBy: { sentAt: 'desc' },
    take,
    skip,
    include: { offer: true }
  })

  res.json(posts)
})

export default router
