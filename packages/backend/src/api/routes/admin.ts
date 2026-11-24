import { Router, Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import QRCode from 'qrcode'
import { runPostingJob, runRepostJob } from '../../jobs/offers.job'
import { prisma } from '../../utils/prisma'
import { publishOffer, postPriority } from '../../utils/publish'
import { connectWhatsApp, getWhatsAppStatus, isWhatsAppEnabled, listWhatsAppGroups, sendWhatsAppToSelf } from '../../channels/whatsapp'

const router = Router()

export function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(503).json({ error: 'ADMIN_SECRET não configurado no servidor' })
  const auth = Buffer.from(String(req.headers['authorization'] || ''))
  const expected = Buffer.from(`Bearer ${secret}`)
  // comparação em tempo constante (não vaza o segredo caractere a caractere)
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    return res.status(401).json({ error: 'Não autorizado' })
  }
  next()
}

router.use(requireAdminSecret)

// Scraping (offers/hub/amazon) não roda mais no Railway — é 100% local via
// `npm run scrape` (ver jobs/scrape-cli.ts). Endpoints remotos removidos.

// POST /api/admin/job/post — posta ofertas pendentes imediatamente
router.post('/job/post', (req, res) => {
  const maxPosts = parseInt(String(req.query.max || '1'), 10)
  runPostingJob(maxPosts, true).catch(console.error)
  res.json({ started: true, job: 'post', maxPosts })
})

// POST /api/admin/job/repost — repost de ofertas válidas
router.post('/job/repost', (req, res) => {
  runRepostJob().catch(console.error)
  res.json({ started: true, job: 'repost' })
})

// GET /api/admin/queue?hours=48 — ofertas aprovadas que ainda não foram para os grupos
router.get('/queue', async (req, res) => {
  const hours = Math.min(parseInt(String(req.query.hours || '48'), 10) || 48, 168)
  const offers = await prisma.offer.findMany({
    where: {
      telegramMessage: { not: null },
      aiScore: { gte: 6 },
      createdAt: { gte: new Date(Date.now() - hours * 3600_000) },
      posts: { none: {} },
    },
    select: {
      id: true, title: true, provider: true, source: true, category: true, imageUrl: true,
      salePrice: true, originalPrice: true, discountPct: true, aiScore: true, couponCode: true,
      createdAt: true, shortCode: true,
    },
    take: 300,
  })
  offers.sort((a, b) => postPriority(b) - postPriority(a))
  res.json({ offers, total: offers.length })
})

// POST /api/admin/offer/:id/send — posta já nos grupos (Telegram + WhatsApp), fura a fila e o horário
router.post('/offer/:id/send', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } })
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' })
  if (!offer.telegramMessage) return res.status(409).json({ error: 'Oferta sem texto gerado (reprovada pela IA)' })
  try {
    const result = await publishOffer(offer)
    if (!result.telegram && result.whatsapp === null) {
      return res.status(409).json({ error: 'Já foi postada (ou está sendo enviada agora)', ...result })
    }
    res.json({ sent: true, ...result })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao enviar' })
  }
})

// GET /api/admin/whatsapp/status — estado da conexão e QR pendente (data URL)
router.get('/whatsapp/status', async (_req, res) => {
  try {
    const { conectado, conectando, qr } = getWhatsAppStatus()
    const qrImage = qr ? await QRCode.toDataURL(qr, { width: 320, margin: 2 }) : null
    res.json({ conectado, conectando, qrImage, habilitado: isWhatsAppEnabled() })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao gerar o QR' })
  }
})

// POST /api/admin/whatsapp/connect — inicia a conexão/pareamento (idempotente)
router.post('/whatsapp/connect', (_req, res) => {
  connectWhatsApp({ pair: true }).catch(err => console.error('[WhatsApp] Falha ao conectar:', err))
  res.json({ started: true })
})

// GET /api/admin/whatsapp/groups — grupos do número, para preencher WHATSAPP_GROUP_JID
router.get('/whatsapp/groups', async (_req, res) => {
  try {
    res.json({ groups: await listWhatsAppGroups() })
  } catch (err: any) {
    res.status(503).json({ error: err?.message || 'WhatsApp não conectado' })
  }
})

// POST /api/admin/whatsapp/notify-self — { text } para o próprio número pareado
router.post('/whatsapp/notify-self', async (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: 'text obrigatório' })
  try {
    res.json({ sent: await sendWhatsAppToSelf(text) })
  } catch (err: any) {
    res.status(503).json({ error: err?.message || 'WhatsApp não conectado' })
  }
})

export default router
