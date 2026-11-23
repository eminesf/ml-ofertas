import { prisma } from '../utils/prisma'

// Limpeza diária do banco: oferta é perecível. A página /oferta/:id some junto
// (vira o 404 do site, que mostra ofertas atuais) e sai do sitemap.
//   - nunca postada e com mais de CLEANUP_UNPOSTED_DAYS (30) dias → apaga
//   - postada, mas último post há mais de CLEANUP_POSTED_DAYS (90) dias → apaga com os posts
//   - histórico de preço de feed (FeedPrice) sem atualização há 90 dias → apaga
// Links curtos /r/ de ofertas apagadas caem na home (não quebram).

const DAY = 24 * 60 * 60 * 1000

export async function runCleanupJob(): Promise<{ unposted: number; posted: number; feedPrices: number }> {
  const unpostedDays = parseInt(process.env.CLEANUP_UNPOSTED_DAYS || '30', 10)
  const postedDays = parseInt(process.env.CLEANUP_POSTED_DAYS || '90', 10)
  const now = Date.now()

  const unposted = await prisma.offer.deleteMany({
    where: { createdAt: { lt: new Date(now - unpostedDays * DAY) }, posts: { none: {} } },
  })

  const postedCutoff = new Date(now - postedDays * DAY)
  const stale = await prisma.offer.findMany({
    where: {
      createdAt: { lt: postedCutoff },
      posts: { some: {} },
      NOT: { posts: { some: { sentAt: { gte: postedCutoff } } } },
    },
    select: { id: true },
  })
  const ids = stale.map(o => o.id)
  if (ids.length) {
    await prisma.$transaction([
      prisma.post.deleteMany({ where: { offerId: { in: ids } } }),
      prisma.offer.deleteMany({ where: { id: { in: ids } } }),
    ])
  }

  const feedPrices = await prisma.feedPrice.deleteMany({ where: { updatedAt: { lt: new Date(now - 90 * DAY) } } })

  const result = { unposted: unposted.count, posted: ids.length, feedPrices: feedPrices.count }
  console.log(`[Cleanup] Apagadas: ${result.unposted} ofertas nunca postadas (>${unpostedDays}d), ${result.posted} postadas antigas (>${postedDays}d), ${result.feedPrices} preços de feed`)
  return result
}
