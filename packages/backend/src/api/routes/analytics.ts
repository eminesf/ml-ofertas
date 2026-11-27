import { Router } from 'express'
import { prisma } from '../../utils/prisma'
import { PROVIDER_LABELS } from '../../providers/registry'

// Painel de análise do /admin/analise. Cliques vêm da tabela Click (link curto /r/,
// com origem); antes de 25/11/2026 só existia o total por oferta (Offer.clicks).
// Awin: relatório por anunciante pela API de publisher, se AWIN_API_TOKEN estiver no .env.

const router = Router()

const SRC_LABEL: Record<string, string> = {
  t: 'Canal Telegram', w: 'WhatsApp Tech & TCG', a: 'WhatsApp Achadinhos', i: 'Instagram (/links)', c: 'Site — páginas de cupom', site: 'Site',
}
// Origem do clique em "Entrar no grupo": página + '-ads' quando veio de anúncio (utm/fbclid)
const ORIGIN_LABEL: Record<string, string> = {
  lp: 'Landing geral (/whatsapp)', 'lp-tech': 'Página Tech & TCG (/grupo/tech)', 'lp-achadinhos': 'Página Achadinhos (/grupo/achadinhos)', links: 'Página /links',
}
function originLabel(src: string | null): string {
  if (!src) return '—'
  const ads = src.endsWith('-ads')
  const base = ads ? src.slice(0, -4) : src
  return (ORIGIN_LABEL[base] || base) + (ads ? ' — anúncio' : '')
}
const CHANNEL_LABEL: Record<string, string> = {
  telegram: 'Canal Telegram', whatsapp: 'WhatsApp Tech & TCG', 'whatsapp-achadinhos': 'WhatsApp Achadinhos',
}
const TZ = 'America/Sao_Paulo'

// GET /api/admin/analytics?days=7
router.get('/', async (req, res) => {
  const days = Math.min(Math.max(parseInt(String(req.query.days || '7'), 10) || 7, 1), 90)
  const since = new Date(Date.now() - days * 86400_000)

  const [clicksByDay, clicksBySrc, clicksByProvider, topClicks, postsByChannel, postsByDay, funnel, totalClicksEver] = await Promise.all([
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char(("at" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM "Click" WHERE "at" >= ${since} AND "provider" <> 'grupo' GROUP BY 1 ORDER BY 1`,
    prisma.click.groupBy({ by: ['src'], where: { at: { gte: since }, provider: { not: 'grupo' } }, _count: { _all: true } }),
    prisma.click.groupBy({ by: ['provider'], where: { at: { gte: since }, provider: { not: 'grupo' } }, _count: { _all: true } }),
    prisma.click.groupBy({ by: ['offerId'], where: { at: { gte: since }, provider: { not: 'grupo' } }, _count: { _all: true }, orderBy: { _count: { offerId: 'desc' } }, take: 15 }),
    prisma.post.groupBy({ by: ['channel'], where: { sentAt: { gte: since }, success: true }, _count: { _all: true } }),
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char(("sentAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, COUNT(DISTINCT "offerId") AS n
      FROM "Post" WHERE "sentAt" >= ${since} AND "success" = true AND "repostedAt" IS NULL GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ provider: string; found: bigint; approved: bigint; posted: bigint }[]>`
      SELECT o."provider",
             COUNT(*) AS found,
             COUNT(*) FILTER (WHERE o."aiScore" >= 6 AND o."telegramMessage" IS NOT NULL) AS approved,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Post" p WHERE p."offerId" = o."id" AND p."success" = true)) AS posted
      FROM "Offer" o WHERE o."createdAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.offer.aggregate({ _sum: { clicks: true } }),
  ])

  // Dias sem clique aparecem com zero (o gráfico não pula dias)
  const dayList: string[] = []
  for (let d = days - 1; d >= 0; d--) {
    dayList.push(new Date(Date.now() - d * 86400_000).toLocaleDateString('en-CA', { timeZone: TZ }))
  }
  const clickMap = new Map(clicksByDay.map(r => [r.day, Number(r.n)]))
  const postMap = new Map(postsByDay.map(r => [r.day, Number(r.n)]))
  const daily = dayList.map(day => ({ day, clicks: clickMap.get(day) || 0, posts: postMap.get(day) || 0 }))

  const offers = await prisma.offer.findMany({
    where: { id: { in: topClicks.map(t => t.offerId) } },
    select: { id: true, title: true, provider: true, salePrice: true, discountPct: true, imageUrl: true },
  })
  const offerById = new Map(offers.map(o => [o.id, o]))
  const top = topClicks.map(t => ({
    clicks: t._count._all,
    offer: offerById.get(t.offerId) || { id: t.offerId, title: t.offerId.startsWith('link:') ? '(link do grupo da Nike — hotsite/lista)' : '(oferta já removida)', provider: '', salePrice: 0, discountPct: 0, imageUrl: null },
  }))

  // Cliques por post em cada canal (quanto cada post rende)
  const srcToChannel: Record<string, string> = { t: 'telegram', w: 'whatsapp', a: 'whatsapp-achadinhos' }
  const bySrc = clicksBySrc
    .map(r => {
      const key = r.src || 'site'
      const channel = srcToChannel[key]
      const posts = channel ? postsByChannel.find(p => p.channel === channel)?._count._all || 0 : null
      return { key, label: SRC_LABEL[key] || key, clicks: r._count._all, posts, perPost: posts ? r._count._all / posts : null }
    })
    .sort((a, b) => b.clicks - a.clicks)

  // Cliques em "Entrar no grupo" por página de origem (landing pages)
  const joins = await prisma.click.groupBy({ by: ['offerId', 'src'], where: { at: { gte: since }, provider: 'grupo' }, _count: { _all: true } })
  const groupJoins = joins
    .map(j => ({ group: j.offerId.replace('grupo:', ''), origin: j.src || '—', originLabel: originLabel(j.src), clicks: j._count._all }))
    .sort((x, y) => y.clicks - x.clicks)

  res.json({
    groupJoins,
    days,
    totals: {
      clicks: daily.reduce((s, d) => s + d.clicks, 0),
      offersPosted: daily.reduce((s, d) => s + d.posts, 0),
      clicksEver: totalClicksEver._sum.clicks || 0,
    },
    daily,
    bySrc,
    byProvider: clicksByProvider
      .map(r => ({ provider: r.provider, label: PROVIDER_LABELS[r.provider] || r.provider, clicks: r._count._all }))
      .sort((a, b) => b.clicks - a.clicks),
    posts: postsByChannel.map(p => ({ channel: p.channel, label: CHANNEL_LABEL[p.channel] || p.channel, count: p._count._all })),
    funnel: funnel.map(f => ({ provider: f.provider, label: PROVIDER_LABELS[f.provider] || f.provider, found: Number(f.found), approved: Number(f.approved), posted: Number(f.posted) })),
    top,
    awin: await awinReport(since).catch(err => ({ error: String(err?.message || err) })),
  })
})

// Relatório por anunciante da Awin (cliques, vendas e comissão). Token: Awin → menu do
// usuário → "API Credentials" → AWIN_API_TOKEN no .env. Cache de 15 min.
let awinCache: { key: string; at: number; data: any } | null = null
async function awinReport(since: Date): Promise<any> {
  const token = process.env.AWIN_API_TOKEN
  if (!token) return { configured: false }
  const publisherId = process.env.AWIN_AFFILIATE_ID || '2953175'
  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
  const key = `${fmt(since)}:${fmt(new Date())}`
  if (awinCache && awinCache.key === key && Date.now() - awinCache.at < 15 * 60_000) return awinCache.data

  const url = `https://api.awin.com/publishers/${publisherId}/reports/advertiser?startDate=${fmt(since)}&endDate=${fmt(new Date())}&region=BR&timezone=${encodeURIComponent(TZ)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Awin respondeu ${res.status}`)
  const rows: any[] = await res.json()
  const data = {
    configured: true,
    advertisers: rows.map(r => ({
      name: r.advertiserName,
      clicks: r.clicks ?? 0,
      sales: (r.totalNo ?? 0) || ((r.pendingNo ?? 0) + (r.confirmedNo ?? 0)),
      saleValue: r.totalValue ?? ((r.pendingValue ?? 0) + (r.confirmedValue ?? 0)),
      commission: r.totalComm ?? ((r.pendingComm ?? 0) + (r.confirmedComm ?? 0)),
      pendingCommission: r.pendingComm ?? 0,
      confirmedCommission: r.confirmedComm ?? 0,
    })).sort((a, b) => b.clicks - a.clicks),
  }
  awinCache = { key, at: Date.now(), data }
  return data
}

export default router
