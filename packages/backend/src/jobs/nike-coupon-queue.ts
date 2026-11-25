import '../env'
import fs from 'fs'
import path from 'path'
import { AwinProvider, AWIN_ADVERTISERS } from '../providers/awin'
import { processOffer } from './offers.job'
import { prisma } from '../utils/prisma'

// Coloca na fila (sem postar) peças de uma seleção de vitrine Nike com cupom.
// Uso: npx tsx src/jobs/nike-coupon-queue.ts <selecao.json> <CUPOM> <pct> <qtdTenis> <qtdCamisetas>
// A seleção sai de data/nike/filtro-nike40.cjs (snapshot lido pelo Chrome).
const [file, coupon = 'NIKE40', pct = '40', nTenis = '12', nCamisetas = '12'] = process.argv.slice(2)
const SKIP = /spurs|caf[eé] swoosh|^camiseta nike masculina$/i

async function main() {
  const sel: any[] = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const provider = new AwinProvider(AWIN_ADVERTISERS.find(a => a.name === 'nike')!)
  const want = { 'Tênis': +nTenis, Camisetas: +nCamisetas } as Record<string, number>
  const done: Record<string, number> = {}
  for (const p of sel) {
    if (!want[p.sub] || (done[p.sub] || 0) >= want[p.sub] || !p.oldPrice || SKIP.test(p.name.trim())) continue
    const externalId = 'NIKE-' + p.url.match(/-(\d{5,})\.html/)[1]
    if (await prisma.offer.findUnique({ where: { externalId }, select: { id: true } })) continue
    done[p.sub] = (done[p.sub] || 0) + 1
    await processOffer({
      externalId, title: p.name.trim(), originalPrice: p.oldPrice, salePrice: p.price,
      discountPct: Math.round((1 - p.price / p.oldPrice) * 100), imageUrl: p.image, productUrl: p.url, category: 'moda',
      sourceNote: `Cupom ${coupon}: +${pct}% OFF em cima do preço atual (cor ${p.color}); no Pix fica ~5% menor`,
    }, provider, coupon, 'coupon', `${pct}%`, undefined, undefined, true, undefined, true)
    console.log('FILA', p.sub, externalId, p.name.trim(), p.color, p.final)
  }
  console.log('TOTAL', done)
  await prisma.$disconnect()
}
main()
