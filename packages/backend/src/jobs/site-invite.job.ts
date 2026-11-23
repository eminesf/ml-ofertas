import { prisma } from '../utils/prisma'
import { SITE_URL } from '../utils/publish'
import { sendPhoto, sendMessage } from '../channels/telegram'
import { isWhatsAppEnabled, isWhatsAppConnected, sendWhatsAppPost } from '../channels/whatsapp'

// Convite para o site, 1x por dia (SITE_INVITE_CRON): lembra que no site tem MAIS
// ofertas do que cabe no grupo, com busca e categorias. Texto rotativo para não cansar.

const SITE = SITE_URL.replace(/^https?:\/\//, '')

const VARIANTS: Array<(n: number) => { telegram: string; whatsapp: string }> = [
  n => ({
    telegram: `🦊 <b>Tem muito mais oferta no site!</b>\n\nAqui no canal vai só uma parte — no site estão as <b>${n} ofertas</b> que garimpamos nas últimas 24h, com busca e categorias.\n\n👉 <a href="${SITE_URL}">${SITE}</a>`,
    whatsapp: `🦊 *Tem muito mais oferta no site!*\n\nAqui no grupo vai só uma parte — no site estão as *${n} ofertas* garimpadas nas últimas 24h, com busca e categorias.\n\n👉 ${SITE_URL}`,
  }),
  n => ({
    telegram: `🔎 <b>Procurando algo específico?</b>\n\nNo site dá pra <b>buscar</b> e filtrar por categoria: eletrônicos, casa, moda, beleza, Pokémon TCG… São ${n} ofertas novas só hoje.\n\n👉 <a href="${SITE_URL}">${SITE}</a>`,
    whatsapp: `🔎 *Procurando algo específico?*\n\nNo site dá pra *buscar* e filtrar por categoria: eletrônicos, casa, moda, beleza, Pokémon TCG… São ${n} ofertas novas só hoje.\n\n👉 ${SITE_URL}`,
  }),
  n => ({
    telegram: `🔥 <b>Perdeu alguma oferta?</b>\n\nTudo que passou por aqui (e mais ${n} ofertas das últimas 24h) fica no site, com o cupom pronto pra copiar.\n\n👉 <a href="${SITE_URL}">${SITE}</a>`,
    whatsapp: `🔥 *Perdeu alguma oferta?*\n\nTudo que passou por aqui (e mais ${n} ofertas das últimas 24h) fica no site, com o cupom pronto pra copiar.\n\n👉 ${SITE_URL}`,
  }),
  n => ({
    telegram: `⚡ <b>As mais quentes do dia estão no site</b>\n\nVote nas melhores, veja o preço antes e depois e ache ${n} promoções novas.\n\n👉 <a href="${SITE_URL}/?ordenar=votes">${SITE}</a>`,
    whatsapp: `⚡ *As mais quentes do dia estão no site*\n\nVote nas melhores, veja o preço antes e depois e ache ${n} promoções novas.\n\n👉 ${SITE_URL}/?ordenar=votes`,
  }),
]

export async function runSiteInviteJob(): Promise<void> {
  const n = await prisma.offer.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600_000) }, aiScore: { gte: 6 } },
  })
  if (n < 5) {
    console.log(`[SiteInvite] só ${n} ofertas nas últimas 24h — convite pulado`)
    return
  }
  const day = Math.floor(Date.now() / 86_400_000)
  const msg = VARIANTS[day % VARIANTS.length](n)
  const image = `${SITE_URL}/opengraph-image`

  const telegram = (await sendPhoto(image, msg.telegram)) || (await sendMessage(msg.telegram))
  let whatsapp: boolean | null = null
  if (isWhatsAppEnabled() && isWhatsAppConnected()) {
    await new Promise(r => setTimeout(r, 20_000)) // espaça do último envio
    whatsapp = await sendWhatsAppPost(msg.whatsapp, image)
  }
  console.log(`[SiteInvite] convite enviado (${n} ofertas) — telegram:${telegram} whatsapp:${whatsapp}`)
}
