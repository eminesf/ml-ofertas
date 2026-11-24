import { prisma } from '../utils/prisma'
import { SITE_URL, canPostNow, ensureShortCode, shortLink, cleanTitle } from '../utils/publish'
import { onGroupJoin, sendWhatsAppGroupText } from '../channels/whatsapp'

// Boas-vindas no grupo do WhatsApp: quem entra não vê as mensagens antigas, então
// o bot responde NO GRUPO marcando os novos membros com as ofertas que já saíram hoje.
// (Mandar no privado de cada um seria o "histórico" completo, mas mensagem para quem
// não falou com o número é o que mais leva a banimento no WhatsApp.)
// Agrupa entradas: espera WELCOME_DEBOUNCE_MIN (3) e no máximo 1 boas-vindas a cada
// WHATSAPP_WELCOME_COOLDOWN_MIN (60) — quem entrar no meio vai na próxima.

const DEBOUNCE_MS = parseInt(process.env.WELCOME_DEBOUNCE_MIN || '3', 10) * 60_000
const COOLDOWN_MS = parseInt(process.env.WHATSAPP_WELCOME_COOLDOWN_MIN || '60', 10) * 60_000
const MAX_OFFERS = 6

const pending = new Set<string>()
let timer: NodeJS.Timeout | null = null
let lastSentAt = 0

function schedule() {
  if (timer) return
  const wait = Math.max(DEBOUNCE_MS, lastSentAt + COOLDOWN_MS - Date.now())
  timer = setTimeout(() => {
    timer = null
    sendWelcome().catch(err => console.error('[Welcome] falhou:', err))
  }, wait)
}

async function buildMessage(jids: string[]): Promise<string> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const posts = await prisma.post.findMany({
    where: { channel: 'whatsapp', success: true, sentAt: { gte: todayStart } },
    orderBy: { sentAt: 'desc' },
    take: 30,
    include: { offer: true },
  })
  // Uma por oferta, mais recentes primeiro (as mais antigas têm mais chance de ter acabado)
  const seen = new Set<string>()
  const offers = posts.map(p => p.offer).filter(o => !seen.has(o.id) && seen.add(o.id)).slice(0, MAX_OFFERS)

  const tags = jids.map(j => '@' + j.split('@')[0].split(':')[0]).join(' ')
  const lines = [`🦊 Boas-vindas ao *Fox Promoções*, ${tags}!`]
  if (offers.length) {
    lines.push('', '🔥 *O que já passou por aqui hoje:*')
    for (const o of offers) {
      const code = await ensureShortCode(o.externalId)
      lines.push(`• ${cleanTitle(o.title).slice(0, 55)} — *R$ ${o.salePrice.toFixed(2).replace('.', ',')}*\n  ${shortLink(code)}`)
    }
  }
  lines.push('', `📲 Todas as ofertas, com busca e categorias: ${SITE_URL}`)
  return lines.join('\n')
}

async function sendWelcome() {
  if (!pending.size) return
  // Madrugada: segura até o horário de posting
  if (!canPostNow()) {
    timer = setTimeout(() => { timer = null; sendWelcome().catch(console.error) }, 30 * 60_000)
    return
  }
  const jids = [...pending]
  pending.clear()
  const ok = await sendWhatsAppGroupText(await buildMessage(jids), jids)
  if (ok) lastSentAt = Date.now()
  console.log(`[Welcome] boas-vindas para ${jids.length} novo(s) membro(s): ${ok}`)
}

export function startWelcomeJob() {
  if (process.env.WHATSAPP_WELCOME_DISABLED === 'true') return
  onGroupJoin(jids => {
    jids.forEach(j => pending.add(j))
    console.log(`[Welcome] ${jids.length} entrou(aram) no grupo — boas-vindas agendadas`)
    schedule()
  })
}
