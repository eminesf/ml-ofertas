import fs from 'fs'
import path from 'path'
import { onSourceMessage, SourceMessage } from '../channels/whatsapp'
import { logSourceMessage } from '../utils/source-links'

// Grupos do WhatsApp como FONTE de ofertas (ex.: grupo de avisos da Nike), só leitura:
// o bot está no grupo, o backend (que tem o socket) guarda as mensagens novas numa
// fila em disco e o job das fontes (jobs/telegram-source.ts, a cada 5 min, processo
// filho) processa — mesmo pipeline dos canais do Telegram (link → produto → IA → envio).
// WHATSAPP_SOURCE_GROUPS=<id>@g.us,...  (entrar: POST /api/admin/whatsapp/join {invite})

const QUEUE_FILE = path.join(__dirname, '..', '..', '..', '.whatsapp-sources-queue.json')
const MAX_AGE_MS = 6 * 3600_000

function read(): SourceMessage[] {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')) } catch { return [] }
}

export function startWhatsAppSourceListener() {
  // sempre registrado: o handler do WhatsApp confere WHATSAPP_SOURCE_GROUPS a cada mensagem
  onSourceMessage(m => {
    // histórico de 3 dias para o /admin/nike (a fila abaixo é consumida pelo job)
    try { logSourceMessage(m) } catch (err: any) { console.warn('[WaSource] histórico:', err?.message) }
    const queue = read().filter(q => Date.now() - q.at < MAX_AGE_MS)
    if (queue.some(q => q.id === m.id)) return
    queue.push(m)
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue.slice(-100)))
    console.log(`[WaSource] mensagem nova do grupo-fonte ${m.group}: ${m.text.split('\n')[0].slice(0, 60)}`)
  })
  if (process.env.WHATSAPP_SOURCE_GROUPS) console.log('[WaSource] lendo grupos-fonte do WhatsApp:', process.env.WHATSAPP_SOURCE_GROUPS)
}

// Pega as mensagens pendentes e esvazia a fila (as recentes demais ficam para a próxima)
export function takeWhatsAppSourceMessages(): SourceMessage[] {
  const queue = read()
  if (!queue.length) return []
  fs.writeFileSync(QUEUE_FILE, '[]')
  return queue.filter(q => Date.now() - q.at < MAX_AGE_MS)
}
