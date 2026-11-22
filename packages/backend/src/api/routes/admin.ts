import { Router, Request, Response, NextFunction } from 'express'
import QRCode from 'qrcode'
import { runPostingJob, runRepostJob } from '../../jobs/offers.job'
import { connectWhatsApp, getWhatsAppStatus, isWhatsAppEnabled, listWhatsAppGroups, sendWhatsAppToSelf } from '../../channels/whatsapp'

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
