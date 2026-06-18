import './env'
import { prisma } from './utils/prisma'

const coupons = [
  {
    code: '#FUCHS20OFF',
    discount: 'R$20 OFF',
    provider: 'mercadolivre',
    expiresAt: new Date('2026-07-01'),
    active: true,
    category: 'geral',
  },
  {
    code: '#FUCHSELECT',
    discount: 'R$30 OFF',
    provider: 'mercadolivre',
    expiresAt: new Date('2026-07-15'),
    active: true,
    category: 'eletrônicos',
  },
  {
    code: '#FUCHSCOPA',
    discount: 'R$15 OFF',
    provider: 'mercadolivre',
    expiresAt: new Date('2026-08-01'),
    active: true,
    category: 'esporte',
  },
]

async function main() {
  console.log('Inserindo cupons...')
  for (const coupon of coupons) {
    const result = await prisma.coupon.upsert({
      where: { code_provider: { code: coupon.code, provider: coupon.provider } },
      create: coupon,
      update: { discount: coupon.discount, expiresAt: coupon.expiresAt, active: coupon.active }
    })
    console.log(`OK ${result.code} - ${result.discount}`)
  }
  console.log('Concluido.')
  await prisma.$disconnect()
}

main().catch(console.error)
