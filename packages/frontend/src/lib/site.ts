// URL pública do site (domínio próprio). Defina NEXT_PUBLIC_SITE_URL na Vercel
// quando o domínio estiver ativo; até lá usa o domínio de produção da Vercel.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://foxpromocoes.vercel.app')
).replace(/\/$/, '')

export const SITE_NAME = 'Fox Ofertas'
export const SITE_TAGLINE = 'Promoções, cupons e descontos de verdade todo dia'
export const SITE_DESCRIPTION = 'Oferta relâmpago, cupom e preço lá embaixo, atualizados o dia todo. Achou, aproveitou — antes que acabe!'
