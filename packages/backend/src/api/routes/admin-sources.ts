import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { listSourceMessages, getSourceMessage, convertSourceText, MEDIA_DIR } from '../../utils/source-links'
import { inWhatsAppLine } from '../../utils/publish'
import { groupByKey, type GroupKey } from '../../utils/groups'
import { sendWhatsAppPost } from '../../channels/whatsapp'
import { sendMessage, sendPhotoFile } from '../../channels/telegram'

// /api/admin/sources — mensagens dos grupos-fonte do WhatsApp (avisos da Nike) com os links
// trocados pelos nossos e o cupom destacado; envio para o nosso grupo/canal com 1 clique.
const router = Router()

// GET / — últimos 3 dias, mais recentes primeiro, já convertidas
router.get('/', async (_req, res) => {
  try {
    const messages = listSourceMessages().slice(0, 40)
    const out = []
    for (const m of messages) out.push({ id: m.id, at: m.at, text: m.text, image: !!m.image, ...(await convertSourceText(m.text)) })
    res.json({ messages: out })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao ler as mensagens' })
  }
})

// POST /convert {text} — texto colado à mão
router.post('/convert', async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 6000)
  if (!text.trim()) return res.status(400).json({ error: 'Cole o texto da mensagem' })
  try {
    res.json(await convertSourceText(text))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao converter' })
  }
})

// GET /:id/image — foto do post
router.get('/:id/image', (req, res) => {
  const m = getSourceMessage(req.params.id)
  const file = m?.image && path.join(MEDIA_DIR, path.basename(m.image))
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Sem foto' })
  res.set('Cache-Control', 'private, max-age=3600').type('jpg').send(fs.readFileSync(file))
})

// POST /send {id?, whatsapp, telegram, group?, withImage?} — texto já editado pelo dono no painel
router.post('/send', async (req, res) => {
  const { id, whatsapp, telegram, withImage = true } = req.body || {}
  const group: GroupKey = req.body?.group === 'tech' ? 'tech' : 'achadinhos'
  if (!whatsapp && !telegram) return res.status(400).json({ error: 'Nada para enviar' })
  const m = id ? getSourceMessage(String(id)) : undefined
  const image = withImage && m?.image ? path.join(MEDIA_DIR, path.basename(m.image)) : null
  const hasImage = !!image && fs.existsSync(image)
  const result: { telegram: boolean | null; whatsapp: boolean | null } = { telegram: null, whatsapp: null }
  try {
    if (telegram) {
      result.telegram = hasImage && String(telegram).length <= 1024
        ? await sendPhotoFile(image!, String(telegram))
        : await sendMessage(String(telegram))
    }
    if (whatsapp) {
      const jid = groupByKey(group).jid()
      result.whatsapp = await inWhatsAppLine(() => sendWhatsAppPost(String(whatsapp), hasImage ? image : null, jid))
    }
    console.log(`[Sources] enviado ${id || '(colado)'}: telegram:${result.telegram} whatsapp(${group}):${result.whatsapp}`)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao enviar', ...result })
  }
})

export default router
