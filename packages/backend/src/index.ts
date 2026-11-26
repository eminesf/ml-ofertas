import './env'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { startScheduler } from './jobs/scheduler'
import offersRouter from './api/routes/offers'
import postsRouter from './api/routes/posts'
import adminRouter from './api/routes/admin'
import { getWhatsAppInviteLink, isWhatsAppEnabled } from './channels/whatsapp'
import { GROUPS } from './utils/groups'
import { prisma } from './utils/prisma'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())

// Snapshot de vitrine lida pelo Chrome do dono (ex.: hotsite NIKE40, que bloqueia o
// servidor): a página manda o JSON para cá e ele vai para data/<pasta>/<nome>.json.
// Só aceita com a chave de uso único em packages/.snapshot-token (criada na hora e apagada após o uso).
app.post('/api/snapshot/:token/:folder/:name', express.text({ type: '*/*', limit: '20mb' }), (req, res) => {
  const tokenFile = path.join(__dirname, '..', '..', '.snapshot-token')
  let token = ''
  try { token = fs.readFileSync(tokenFile, 'utf8').trim() } catch {}
  if (!token || req.params.token !== token) return res.status(401).end()
  const { folder, name } = req.params
  if (!/^[a-z0-9-]+$/i.test(folder) || !/^[a-z0-9.-]+\.json$/i.test(name)) return res.status(400).end()
  try { JSON.parse(req.body) } catch { return res.status(400).json({ error: 'JSON inválido' }) }
  const dir = path.join(__dirname, '..', '..', '..', 'data', folder)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), req.body)
  fs.unlinkSync(tokenFile)
  console.log(`[Snapshot] data/${folder}/${name} gravado (${req.body.length} bytes)`)
  res.json({ saved: `data/${folder}/${name}`, bytes: req.body.length })
})

app.use(express.json())

// Links públicos dos canais (botões do site). WhatsApp vem do próprio grupo via Baileys.
// Clique em "Entrar no grupo" (landing pages /grupo/*, /whatsapp, /links): vai para a tabela Click
// com provider 'grupo', offerId 'grupo:<tech|achadinhos>' e src = página de origem (ex.: 'lp-ads').
// Chamado pelo site (rota /entrar/[grupo]) antes de redirecionar para o convite.
app.post('/api/channels/join', express.json(), async (req, res) => {
  const group = GROUPS.find(g => g.key === req.body?.group)
  if (!group) return res.status(400).json({ error: 'grupo inválido' })
  const ua = String(req.body?.ua || '')
  if (!/bot|crawl|spider|preview|facebookexternalhit|whatsapp\/|headless/i.test(ua)) {
    const src = String(req.body?.origin || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || null
    await prisma.click.create({ data: { offerId: `grupo:${group.key}`, provider: 'grupo', src } }).catch(() => {})
  }
  res.json({ ok: true })
})

app.get('/api/channels', async (_req, res) => {
  const whatsapp = isWhatsAppEnabled() ? await getWhatsAppInviteLink().catch(() => null) : null
  // Os dois grupos (Tech & TCG e Achadinhos) para o modal de escolha do site
  const whatsappGroups = isWhatsAppEnabled()
    ? (await Promise.all(GROUPS.map(async g => ({
        key: g.key,
        label: g.label,
        description: g.description,
        url: await getWhatsAppInviteLink(g.jid()).catch(() => null),
      })))).filter(g => g.url)
    : []
  res.set('Cache-Control', 'public, max-age=300').json({ whatsapp, whatsappGroups, telegram: 'https://t.me/e_foxofertas' })
})
app.use('/api/offers', offersRouter)
app.use('/api/posts', postsRouter)
app.use('/api/admin', adminRouter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`[Server] Rodando em http://localhost:${PORT}`)
  startScheduler()
})

