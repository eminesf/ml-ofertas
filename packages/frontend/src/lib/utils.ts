import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export const STORES: Record<string, { label: string; className: string }> = {
  mercadolivre: { label: 'Mercado Livre', className: 'bg-[#fff159] text-[#2d3277]' },
  amazon: { label: 'Amazon', className: 'bg-[#232f3e] text-[#ff9900]' },
  shopee: { label: 'Shopee', className: 'bg-[#ee4d2d] text-white' },
  kabum: { label: 'KaBuM!', className: 'bg-[#0f2b92] text-[#ff6500]' },
  aliexpress: { label: 'AliExpress', className: 'bg-[#e62e04] text-white' },
  stanley: { label: 'Stanley', className: 'bg-[#1a3c34] text-white' },
  nike: { label: 'Nike', className: 'bg-black text-white' },
}

export function storeName(provider: string): string {
  return STORES[provider]?.label || provider
}

export const CATEGORIES = [
  { slug: 'eletronicos', label: 'Eletrônicos', short: 'Eletrônicos' },
  { slug: 'casa', label: 'Casa e Eletrodomésticos', short: 'Casa' },
  { slug: 'moda', label: 'Moda e Acessórios', short: 'Moda' },
  { slug: 'beleza', label: 'Beleza e Cuidados', short: 'Beleza' },
  { slug: 'esporte', label: 'Esporte e Suplementos', short: 'Esporte' },
  { slug: 'automotivo', label: 'Automotivo', short: 'Automotivo' },
  { slug: 'ferramentas', label: 'Ferramentas', short: 'Ferramentas' },
  { slug: 'pokemon', label: 'Pokémon TCG', short: 'Pokémon' },
] as const

// Link do "Copiar e ir à loja": passa pela página /ir (mostra "cupom copiado" e depois abre a loja
// pelo nosso link curto /r/, que deixa o cookie de afiliado). Sem link curto, vai direto ao afiliado.
export function couponGoHref(o: { shortCode?: string | null; affiliateUrl: string; provider: string }, coupon: string, src?: string): string {
  if (!o.shortCode) return o.affiliateUrl
  const qs = new URLSearchParams({ r: o.shortCode, cupom: coupon, loja: storeName(o.provider) })
  if (src) qs.set('s', src)
  return `/ir?${qs}`
}
