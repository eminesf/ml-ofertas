import { prisma } from '../utils/prisma'
import { SITE_URL, canPostNow, ensureShortCode, shortLink, cleanTitle } from '../utils/publish'
import { onGroupJoin, sendWhatsAppDirect } from '../channels/whatsapp'

// Histórico para quem entra no grupo do WhatsApp: quem entra não vê as mensagens
// antigas, então o bot manda NO PRIVADO da pessoa uma mensagem com as ofertas que já
// saíram no grupo hoje. Nada é postado no grupo.
// Cuidado com ban: mensagem para quem nunca falou com o número é o que o WhatsApp
// mais pune. Por isso: 1 mensagem só por pessoa, 45–90s entre pessoas, no máx
// WHATSAPP_HISTORY_DAILY_MAX (40) por dia e só no horário de posting.
// WHATSAPP_HISTORY_DISABLED=true desliga.

const MAX_OFFERS = 8
const DAILY_MAX = parseInt(process.env.WHATSAPP_HISTORY_DAILY_MAX || '40', 10)

const queue: string[] = []
const sentTo = new Set<string>() // não repete para quem sai e entra de novo (até reiniciar)
let running = false
let day = ''
let sentToday = 0

async function buildHistory(): Promise<string | null> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const posts = await prisma.post.findMany({
    where: { channel: 'whatsapp', success: true, sentAt: { gte: todayStart } },
    orderBy: { sentAt: 'desc' },
    take: 40,
    include: { offer: true },
  })
  const seen = new Set<string>()
  const offers = posts.map(p => p.offer).filter(o => !seen.has(o.id) && seen.add(o.id)).slice(0, MAX_OFFERS)
  if (!offers.length) return null

  const lines = ['🦊 *Fox Promoções* — ofertas que já passaram no grupo hoje:', '']
  for (const o of offers) {
    const code = await ensureShortCode(o.externalId)
    lines.push(`🔥 ${cleanTitle(o.title).slice(0, 60)}\n💰 *R$ ${o.salePrice.toFixed(2).replace('.', ',')}*${o.couponCode ? ` · cupom ${o.couponCode}` : ''}\n👉 ${shortLink(code)}`, '')
  }
  lines.push(`📲 Todas as ofertas: ${SITE_URL}`)
  return lines.join('\n')
}

async function drain() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      // Madrugada: espera o horário de posting
      if (!canPostNow()) {
        await new Promise(r => setTimeout(r, 30 * 60_000))
        continue
      }
      const today = new Date().toDateString()
      if (today !== day) { day = today; sentToday = 0 }
      if (sentToday >= DAILY_MAX) {
        console.log(`[History] limite diário (${DAILY_MAX}) atingido — ${queue.length} pessoa(s) ficam sem histórico`)
        queue.length = 0
        break
      }
      const jid = queue.shift()!
      const text = await buildHistory()
      if (!text) continue // nada postado hoje ainda
      const ok = await sendWhatsAppDirect(jid, text)
      if (ok) { sentToday++; sentTo.add(jid) }
      console.log(`[History] histórico para novo membro: ${ok}`)
      if (queue.length) await new Promise(r => setTimeout(r, 45_000 + Math.random() * 45_000))
    }
  } finally {
    running = false
  }
}

export function startWelcomeJob() {
  if (process.env.WHATSAPP_HISTORY_DISABLED === 'true') return
  onGroupJoin(jids => {
    const fresh = jids.filter(j => !sentTo.has(j) && !queue.includes(j))
    queue.push(...fresh)
    console.log(`[History] ${jids.length} entrou(aram) no grupo — histórico na fila`)
    // Pequena espera: a pessoa acabou de entrar e ainda está olhando o grupo
    setTimeout(() => drain().catch(err => console.error('[History] falhou:', err)), 60_000)
  })
}
