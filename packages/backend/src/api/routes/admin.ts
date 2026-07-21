import { Router, Request, Response, NextFunction } from 'express'
import { runPostingJob, runRepostJob } from '../../jobs/offers.job'

const router = Router()

function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(503).json({ error: 'ADMIN_SECRET não configurado no servidor' })
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'Não autorizado' })
  next()
}

router.use(requireAdminSecret)

// Scraping (offers/hub/amazon) não roda mais no Railway — é 100% local via
// `npm run scrape` (ver jobs/scrape-cli.ts). Endpoints remotos removidos.

// POST /api/admin/job/post — posta ofertas pendentes imediatamente
router.post('/job/post', (req, res) => {
  const maxPosts = parseInt(String(req.query.max || process.env.ML_POST_MAX || '5'), 10)
  runPostingJob(maxPosts).catch(console.error)
  res.json({ started: true, job: 'post', maxPosts })
})

// POST /api/admin/job/repost — repost de ofertas válidas
router.post('/job/repost', (req, res) => {
  runRepostJob().catch(console.error)
  res.json({ started: true, job: 'repost' })
})

export default router
