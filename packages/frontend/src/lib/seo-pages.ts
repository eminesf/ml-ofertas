// Páginas de SEO: /cupons, /cupom/[loja] e /black-friday.
// Ideia: ganhar buscas específicas ("cupom nike", "cupom kabum hoje") que têm pouca concorrência,
// com conteúdo que se atualiza sozinho (cupons e ofertas que o bot já garimpa).
import type { Offer } from './api'

export interface StorePage {
  slug: string // URL: /cupom/<slug>
  provider: string // Offer.provider
  name: string
  intro: string
  howTo: string[]
  tips: string[]
}

export const STORE_PAGES: StorePage[] = [
  {
    slug: 'mercado-livre', provider: 'mercadolivre', name: 'Mercado Livre',
    intro: 'Cupons e ofertas do Mercado Livre que a gente encontrou nos últimos dias, com o preço conferido na hora em que a oferta entrou no site.',
    howTo: [
      'Clique na oferta e abra o produto no Mercado Livre.',
      'Adicione ao carrinho e, no checkout, procure "Adicionar cupom" ou "Cupons".',
      'Cole o código e confira o desconto antes de pagar. Alguns cupons pedem um valor mínimo no carrinho.',
    ],
    tips: [
      'Cupom com valor mínimo vale para o carrinho todo: dá para juntar produtos para chegar no mínimo.',
      'Muitos cupons valem só uma vez por conta e acabam rápido quando a promoção é boa.',
    ],
  },
  {
    slug: 'amazon', provider: 'amazon', name: 'Amazon',
    intro: 'Promoções e cupons da Amazon Brasil garimpados todo dia: ofertas do dia, quedas de preço e produtos com cupom para ativar na página.',
    howTo: [
      'Abra a oferta na Amazon.',
      'Se houver um selo "Aplicar cupom" na página do produto, marque a caixinha antes de adicionar ao carrinho.',
      'Códigos promocionais vão no campo "Cupons e vales" na finalização da compra.',
    ],
    tips: [
      'O preço da Amazon muda várias vezes por dia: confira o valor final no carrinho.',
      'Ofertas relâmpago têm estoque limitado e um contador na página.',
    ],
  },
  {
    slug: 'shopee', provider: 'shopee', name: 'Shopee',
    intro: 'Achadinhos e cupons da Shopee com desconto de verdade: produtos bem avaliados, de lojas com boa reputação, com o preço "de" conferido.',
    howTo: [
      'Abra a oferta no app ou site da Shopee.',
      'Resgate os cupons da loja e da Shopee na página do produto (botão "Resgatar").',
      'No checkout, toque em "Cupom Shopee" e escolha o cupom resgatado.',
    ],
    tips: [
      'Combine cupom da loja + cupom da Shopee + frete grátis quando a oferta permitir.',
      'Veja a nota e o número de vendas da loja antes de comprar.',
    ],
  },
  {
    slug: 'kabum', provider: 'kabum', name: 'KaBuM!',
    intro: 'Quedas de preço e cupons da KaBuM!: placa de vídeo, SSD, processador, monitor, console e periféricos. A gente compara com o preço anterior para mostrar só desconto real.',
    howTo: [
      'Abra a oferta na KaBuM!.',
      'Adicione ao carrinho e informe o cupom no campo "Cupom de desconto" do carrinho.',
      'Confira o preço no Pix, que costuma ser menor que no cartão.',
    ],
    tips: [
      'As ofertas da KaBuM! mudam rápido, principalmente as relâmpago com estoque limitado.',
      'O preço anunciado normalmente é o do Pix à vista.',
    ],
  },
  {
    slug: 'nike', provider: 'nike', name: 'Nike',
    intro: 'Cupons Nike e tênis em promoção na Nike.com.br: Air Max, Dunk, Court e linha de corrida, com o desconto e o cupom do momento.',
    howTo: [
      'Abra a oferta na Nike.com.br e escolha cor e tamanho.',
      'No carrinho, clique em "Tem um código promocional?" e cole o cupom.',
      'O desconto aparece no resumo do pedido antes do pagamento.',
    ],
    tips: [
      'Cupons da Nike costumam valer só para produtos selecionados e por poucos dias.',
      'Tamanhos populares esgotam primeiro em promoção.',
    ],
  },
  {
    slug: 'stanley', provider: 'stanley', name: 'Stanley',
    intro: 'Copos, garrafas e Quenchers da Stanley em promoção no site oficial, com o preço "de" conferido.',
    howTo: [
      'Abra a oferta no site da Stanley.',
      'Adicione ao carrinho e aplique o código promocional no checkout, se houver.',
    ],
    tips: ['Cores de edição limitada esgotam rápido.'],
  },
  {
    slug: 'aliexpress', provider: 'aliexpress', name: 'AliExpress',
    intro: 'Ofertas e cupons do AliExpress com envio para o Brasil.',
    howTo: [
      'Abra a oferta no AliExpress.',
      'Resgate os cupons da loja e da plataforma na página do produto.',
      'No pagamento, confira se os cupons foram aplicados e o valor de impostos.',
    ],
    tips: ['Confira o prazo de entrega e a avaliação da loja.'],
  },
]

export function storeBySlug(slug: string) {
  return STORE_PAGES.find(s => s.slug === slug)
}

export function storeByProvider(provider: string) {
  return STORE_PAGES.find(s => s.provider === provider)
}

export interface CouponSummary {
  code: string
  provider: string
  minValue: number | null
  lastSeen: string
  offers: Offer[]
}

// Agrupa os cupons das ofertas recentes (um cartão por código)
export function collectCoupons(offers: Offer[], maxAgeDays = 10): CouponSummary[] {
  const since = Date.now() - maxAgeDays * 86400000
  const map = new Map<string, CouponSummary>()
  for (const o of offers) {
    if (!o.couponCode || new Date(o.createdAt).getTime() < since) continue
    const code = o.couponCode.trim()
    const key = `${o.provider}:${code.toUpperCase()}`
    const c = map.get(key) || { code, provider: o.provider, minValue: o.couponMinValue ?? null, lastSeen: o.createdAt, offers: [] }
    c.offers.push(o)
    if (o.createdAt > c.lastSeen) c.lastSeen = o.createdAt
    map.set(key, c)
  }
  return [...map.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
}

export function monthYear() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}
