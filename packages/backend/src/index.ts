import './env'
import express from 'express'
import cors from 'cors'
import { startScheduler } from './jobs/scheduler'
import offersRouter from './api/routes/offers'
import postsRouter from './api/routes/posts'
import adminRouter from './api/routes/admin'
import { getWhatsAppInviteLink, isWhatsAppEnabled } from './channels/whatsapp'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Links públicos dos canais (botões do site). WhatsApp vem do próprio grupo via Baileys.
app.get('/api/channels', async (_req, res) => {
  const whatsapp = isWhatsAppEnabled() ? await getWhatsAppInviteLink().catch(() => null) : null
  res.set('Cache-Control', 'public, max-age=300').json({ whatsapp, telegram: 'https://t.me/e_foxofertas' })
})
app.use('/api/offers', offersRouter)
app.use('/api/posts', postsRouter)
app.use('/api/admin', adminRouter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`[Server] Rodando em http://localhost:${PORT}`)
  startScheduler()
})

