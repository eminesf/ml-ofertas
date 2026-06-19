import Anthropic from '@anthropic-ai/sdk'
import { RawOffer } from '../providers/base.provider'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function stripMarkdown(text: string): string {
  return text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
}

const TRENDS_CONTEXT = `
Contexto de tendências atuais (junho/julho 2026):
- Copa do Mundo FIFA 26 (EUA/Canadá/México): alta demanda por álbuns Panini, figurinhas, camisetas de seleção (Brasil, Argentina, Portugal)
- Pokémon TCG: cartas e boosters em alta constante no Brasil
- Temporada de inverno no Brasil: roupas e calçados aquecidos, cobertores
- Eletrônicos: sempre em alta, especialmente com desconto > 25%
- Nike e Adidas com descontos reais são excelentes conversores
`

export interface OfferEvaluation {
  score: number
  shouldPost: boolean
  reason: string
}

export interface MarketAnalysis {
  isCompetitive: boolean
  reason: string
  suggestedHighlight: string
}

export interface GeneratedPost {
  telegram: string
  whatsapp: string
}

export interface CouponContext {
  code: string
  discount: string       // ex: "R$ 20 OFF"
  effectivePrice: number // preço após cupom (só válido quando canApplyAlone = true)
  minValue?: number      // ex: 120 → compra mínima de R$120
  canApplyAlone: boolean // produto sozinho atinge o valor mínimo do cupom
}

export async function evaluateOffer(offer: RawOffer): Promise<OfferEvaluation> {
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const prompt = `Você é um especialista em ofertas e afiliados no Brasil. Data de hoje: ${today}.
${TRENDS_CONTEXT}
Avalie essa oferta do Mercado Livre com nota de 0 a 10.

Oferta:
- Título: ${offer.title}
- Preço original: R$ ${offer.originalPrice}
- Preço com desconto: R$ ${offer.salePrice}
- Desconto: ${offer.discountPct}%
- Categoria: ${offer.category || 'não informada'}
- Avaliação: ${offer.rating || 'sem avaliação'}

Critérios de pontuação:
- Desconto ≥ 25% = +2 pontos
- Produto com avaliação ≥ 4 = +2 pontos
- Produto relacionado a tendências atuais (Copa, Pokémon) = +2 pontos
- Preço final ≤ R$200 (alto volume) = +1 ponto
- Categoria popular (eletrônicos, moda, esporte) = +1 ponto

Responda APENAS com JSON válido, sem markdown:
{"score": 7, "shouldPost": true, "reason": "motivo breve"}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(stripMarkdown(text)) as OfferEvaluation
  } catch {
    return { score: 5, shouldPost: false, reason: 'Erro ao parsear resposta da IA' }
  }
}

export async function analyzeMarketValue(offer: RawOffer): Promise<MarketAnalysis> {
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const prompt = `Você é um analista de mercado especializado em e-commerce brasileiro. Data: ${today}.
${TRENDS_CONTEXT}
Analise esse produto:

- Título: ${offer.title}
- Preço atual: R$ ${offer.salePrice}
- Desconto: ${offer.discountPct}%

Avalie:
1. Se o preço parece competitivo para o mercado brasileiro
2. Se o produto tem alta demanda neste momento (Copa FIFA 26, Pokémon, etc.)
3. Qual destaque usar no copy de vendas

Responda APENAS com JSON válido, sem markdown:
{"isCompetitive": true, "reason": "motivo curto", "suggestedHighlight": "Menor preço do mercado"}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 250,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(stripMarkdown(text)) as MarketAnalysis
  } catch {
    return { isCompetitive: true, reason: 'Análise indisponível', suggestedHighlight: 'Oferta limitada' }
  }
}

export async function evaluateCouponOffer(offer: RawOffer, coupon: CouponContext): Promise<OfferEvaluation> {
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const priceInfo = coupon.canApplyAlone
    ? `- Preço com cupom aplicado: R$ ${coupon.effectivePrice.toFixed(2)}`
    : `- Preço do produto: R$ ${offer.salePrice.toFixed(2)} (cupom requer compra mínima de R$${coupon.minValue} — o cliente pode combinar produtos no carrinho para atingir o valor)`

  const prompt = `Você é um especialista em ofertas e afiliados no Brasil. Data de hoje: ${today}.
${TRENDS_CONTEXT}
Avalie esse produto que possui um CUPOM DE DESCONTO EXCLUSIVO com nota de 0 a 10.

Produto:
- Título: ${offer.title}
- Preço atual: R$ ${offer.salePrice.toFixed(2)}
- Desconto do cupom: ${coupon.discount}
${priceInfo}
- Cupom: ${coupon.code}
- Avaliação: ${offer.rating || 'sem avaliação'}
- Categoria: ${offer.category || 'não informada'}

Critérios de pontuação:
- Preço do produto ≤ R$100 = +3 pontos (bom para combo de carrinho)
- Preço do produto ≤ R$200 = +2 pontos
- Produto relacionado a tendências atuais (Copa FIFA 26, Pokémon, inverno) = +2 pontos
- Avaliação ≥ 4 estrelas = +2 pontos
- Categoria popular (eletrônicos, moda, esporte, suplementos) = +1 ponto
- Cupom exclusivo de afiliado = sempre +1 ponto (diferencial competitivo)

IMPORTANTE: O cupom aplica no CARRINHO TOTAL, não por produto isolado. Produtos abaixo do mínimo são ótimos para combinar com outros e ativar o cupom — isso NÃO penaliza a nota.

Responda APENAS com JSON válido, sem markdown:
{"score": 7, "shouldPost": true, "reason": "motivo breve considerando o cupom"}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(stripMarkdown(text)) as OfferEvaluation
  } catch {
    return { score: 5, shouldPost: false, reason: 'Erro ao parsear resposta da IA' }
  }
}

export async function generateCouponPostMessage(
  offer: RawOffer,
  affiliateUrl: string,
  coupon: CouponContext,
  suggestedHighlight?: string
): Promise<GeneratedPost> {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const styles = ['urgente', 'informativo', 'entusiasmado']
  const style = styles[Math.floor(Math.random() * styles.length)]

  const couponBlock = coupon.canApplyAlone
    ? `   💰 Preço: R$ ${offer.salePrice.toFixed(2)}
   🎟️ Cupom: <code>${coupon.code}</code> → <b>${coupon.discount}</b>
   ✅ Você paga: <b>R$ ${coupon.effectivePrice.toFixed(2)}</b>`
    : `   💰 Preço: R$ ${offer.salePrice.toFixed(2)}
   🎟️ Cupom: <code>${coupon.code}</code> → <b>${coupon.discount}</b> em compras na loja
   ⚠️ <i>Adicione ao carrinho com outros itens da loja para ativar o cupom (mín. R$${coupon.minValue})</i>`

  const whatsappCouponBlock = coupon.canApplyAlone
    ? `💰 R$ ${offer.salePrice.toFixed(2)} → use ${coupon.code} → R$ ${coupon.effectivePrice.toFixed(2)}`
    : `💰 R$ ${offer.salePrice.toFixed(2)} | Cupom ${coupon.code} (${coupon.discount})\n⚠️ Válido combinando itens no carrinho acima de R$${coupon.minValue}`

  const prompt = `Você é um copywriter expert em ofertas para canais do Telegram e WhatsApp no Brasil.
Data: ${today}
${TRENDS_CONTEXT}

Produto com CUPOM EXCLUSIVO DE AFILIADO:
- Produto: ${offer.title}
- Preço atual: R$ ${offer.salePrice.toFixed(2)}
- Cupom: ${coupon.code} (${coupon.discount})
${coupon.canApplyAlone
  ? `- Preço final com cupom: R$ ${coupon.effectivePrice.toFixed(2)} (cupom aplicável sozinho)`
  : `- Cupom requer carrinho mínimo de R$${coupon.minValue} — cliente pode combinar produtos`}
${suggestedHighlight ? `- Destaque: ${suggestedHighlight}` : ''}
- Avaliação: ${offer.rating ? `${offer.rating} ⭐` : 'N/A'}
- Link: ${affiliateUrl}

Estilo: ${style}

Gere DUAS versões usando EXATAMENTE o bloco de preço/cupom abaixo (não invente outros valores):

Telegram (use HTML: <b>, <i>, <s>, <code>, <a href="">):
🏷️ <b>TÍTULO CHAMATIVO AQUI</b>

${couponBlock}
${offer.rating ? `   ⭐ ${offer.rating}/5.0` : ''}

   👉 <a href="${affiliateUrl}">🔥 COMPRAR COM CUPOM AGORA</a>

   📌 DESTAQUE (1 linha de copy motivacional)

WhatsApp (apenas texto + emojis, sem HTML, máximo 6 linhas):
${whatsappCouponBlock}
👉 ${affiliateUrl}

Responda APENAS com JSON válido, sem markdown:
{"telegram": "mensagem telegram aqui", "whatsapp": "mensagem whatsapp aqui"}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(stripMarkdown(text)) as GeneratedPost
  } catch {
    const effectiveLine = coupon.canApplyAlone
      ? `✅ Pague: <b>R$ ${coupon.effectivePrice.toFixed(2)}</b>`
      : `⚠️ <i>Use no carrinho (mín. R$${coupon.minValue})</i>`
    const fallback = `🏷️ <b>${offer.title}</b>\n\n💰 R$ ${offer.salePrice.toFixed(2)}\n🎟️ Cupom: <code>${coupon.code}</code> (${coupon.discount})\n${effectiveLine}\n\n👉 <a href="${affiliateUrl}">Comprar com cupom</a>`
    return { telegram: fallback, whatsapp: `🏷️ ${offer.title}\nR$ ${offer.salePrice.toFixed(2)} | Cupom ${coupon.code}\n👉 ${affiliateUrl}` }
  }
}

export async function generatePostMessage(
  offer: RawOffer,
  affiliateUrl: string,
  couponCode?: string,
  suggestedHighlight?: string
): Promise<GeneratedPost> {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Varia o estilo para não ser repetitivo
  const styles = ['urgente', 'informativo', 'entusiasmado']
  const style = styles[Math.floor(Math.random() * styles.length)]

  const prompt = `Você é um copywriter expert em ofertas para canais do Telegram e WhatsApp no Brasil.
Data: ${today}
${TRENDS_CONTEXT}

Produto: ${offer.title}
De: R$ ${offer.originalPrice?.toFixed(2)} → Por: R$ ${offer.salePrice.toFixed(2)} (${offer.discountPct}% OFF)
${couponCode ? `Cupom extra: ${couponCode}` : ''}
${suggestedHighlight ? `Destaque sugerido: ${suggestedHighlight}` : ''}
Avaliação: ${offer.rating ? `${offer.rating} ⭐` : 'N/A'}
Link: ${affiliateUrl}

Estilo desta mensagem: ${style} (varie sempre para não repetir)

Gere DUAS versões:
1. Telegram (suporta HTML: use <b>, <i>, <s>, <code>, <a href="">):
   Formato:
   🔥 <b>TÍTULO</b>

   💰 De: <s>R$ XX</s> → <b>R$ YY</b> (-Z%)
   ${couponCode ? '🎟️ Cupom: <code>CÓDIGO</code>' : ''}
   ⭐ Avaliação: X.X

   👉 <a href="LINK">Comprar agora</a>

   📌 DESTAQUE PRINCIPAL

2. WhatsApp (apenas texto + emojis, sem HTML):
   Compacto, máximo 5 linhas

Responda APENAS com JSON válido, sem markdown:
{"telegram": "mensagem telegram aqui", "whatsapp": "mensagem whatsapp aqui"}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(stripMarkdown(text)) as GeneratedPost
  } catch {
    const fallback = `🔥 <b>${offer.title}</b>\n\n💰 De: <s>R$ ${offer.originalPrice?.toFixed(2)}</s> → <b>R$ ${offer.salePrice.toFixed(2)}</b> (-${offer.discountPct}%)\n\n👉 <a href="${affiliateUrl}">Comprar agora</a>`
    return { telegram: fallback, whatsapp: `🔥 ${offer.title}\nDe R$${offer.originalPrice?.toFixed(2)} por R$${offer.salePrice.toFixed(2)} (${offer.discountPct}% OFF)\n👉 ${affiliateUrl}` }
  }
}
