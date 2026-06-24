import Database from 'better-sqlite3'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const SQLITE_PATH = path.resolve(__dirname, '../prisma/dev.db')
const sqlite = new Database(SQLITE_PATH, { readonly: true })
const prisma = new PrismaClient()

async function main() {
  const offers = sqlite.prepare('SELECT * FROM Offer').all() as any[]
  console.log(`[migrate] ${offers.length} offers encontradas`)
  for (const o of offers) {
    await prisma.offer.upsert({
      where: { externalId: o.externalId },
      create: {
        id: o.id,
        externalId: o.externalId,
        provider: o.provider,
        title: o.title,
        couponAmount: o.couponAmount ?? null,
        couponCode: o.couponCode ?? null,
        couponExpiresAt: o.couponExpiresAt ? new Date(o.couponExpiresAt) : null,
        originalPrice: o.originalPrice,
        salePrice: o.salePrice,
        discountPct: o.discountPct,
        imageUrl: o.imageUrl ?? null,
        productUrl: o.productUrl,
        affiliateUrl: o.affiliateUrl,
        category: o.category ?? null,
        rating: o.rating ?? null,
        aiScore: o.aiScore ?? null,
        suggestedHighlight: o.suggestedHighlight ?? null,
        telegramMessage: o.telegramMessage ?? null,
        whatsappMessage: o.whatsappMessage ?? null,
        source: o.source ?? 'offers-page',
        upvotes: o.upvotes ?? 0,
        createdAt: new Date(o.createdAt),
      },
      update: {},
    })
  }
  console.log(`[migrate] offers: ok`)

  const coupons = sqlite.prepare('SELECT * FROM Coupon').all() as any[]
  console.log(`[migrate] ${coupons.length} coupons encontrados`)
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code_provider: { code: c.code, provider: c.provider } },
      create: {
        id: c.id,
        provider: c.provider,
        code: c.code,
        discount: c.discount,
        minValue: c.minValue ?? null,
        category: c.category ?? null,
        expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
        active: Boolean(c.active),
        createdAt: new Date(c.createdAt),
      },
      update: {},
    })
  }
  console.log(`[migrate] coupons: ok`)

  const posts = sqlite.prepare('SELECT * FROM Post').all() as any[]
  console.log(`[migrate] ${posts.length} posts encontrados`)
  for (const p of posts) {
    await prisma.post.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        offerId: p.offerId,
        channel: p.channel,
        message: p.message,
        whatsappMessage: p.whatsappMessage ?? null,
        sentAt: new Date(p.sentAt),
        repostedAt: p.repostedAt ? new Date(p.repostedAt) : null,
        success: Boolean(p.success),
      },
      update: {},
    })
  }
  console.log(`[migrate] posts: ok`)

  console.log('[migrate] Migração concluída!')
  sqlite.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
