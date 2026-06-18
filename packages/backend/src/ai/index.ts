import Anthropic from '@anthropic-ai/sdk'
import { RawOffer } from '../providers/base.provider'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text) as OfferEvaluation
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
    model: 'claude-sonnet-4-6',
    max_tokens: 250,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text) as MarketAnalysis
  } catch {
    return { isCompetitive: true, reason: 'Análise indisponível', suggestedHighlight: 'Oferta limitada' }
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
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text) as GeneratedPost
  } catch {
    const fallback = `🔥 <b>${offer.title}</b>\n\n💰 De: <s>R$ ${offer.originalPrice?.toFixed(2)}</s> → <b>R$ ${offer.salePrice.toFixed(2)}</b> (-${offer.discountPct}%)\n\n👉 <a href="${affiliateUrl}">Comprar agora</a>`
    return { telegram: fallback, whatsapp: `🔥 ${offer.title}\nDe R$${offer.originalPrice?.toFixed(2)} por R$${offer.salePrice.toFixed(2)} (${offer.discountPct}% OFF)\n👉 ${affiliateUrl}` }
  }
}
