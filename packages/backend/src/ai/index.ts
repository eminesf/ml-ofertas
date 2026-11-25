import { RawOffer } from '../providers/base.provider'

// IA via OpenRouter (deepseek-chat) — formato OpenAI-compatible.
// OPENROUTER_MODEL permite trocar de modelo sem mexer no código.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat'

async function chat(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada')

  // 429/5xx costumam ser limite temporário do provedor do modelo no OpenRouter
  // (já derrubou repost em 10/11) — tenta de novo com espera crescente.
  const esperas = [5000, 15000, 30000]
  for (let tentativa = 0; ; tentativa++) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(90000),
    })

    if (res.ok) {
      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? ''
    }

    const body = await res.text().catch(() => '')
    const temporario = res.status === 429 || res.status >= 500
    if (!temporario || tentativa >= esperas.length) {
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`)
    }
    console.warn(`[IA] OpenRouter ${res.status} — tentando de novo em ${esperas[tentativa] / 1000}s`)
    await new Promise(r => setTimeout(r, esperas[tentativa]))
  }
}

function stripMarkdown(text: string): string {
  return text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
}

// Atualizar a cada estação/data comercial — a IA usa isso na nota e no copy.
const TRENDS_CONTEXT = `
Contexto de tendências atuais (novembro/dezembro 2026):
- Black Friday (27/11) e Cyber Monday: público caçando desconto real; comparar com o preço de antes
- Natal: presentes até ~R$200 (eletrônicos pequenos, perfumes, brinquedos, kits de beleza, garrafas térmicas)
- 13º salário caindo: compras maiores (celular, notebook, TV, eletrodomésticos)
- Verão chegando no Brasil: ventilador, ar-condicionado, garrafa térmica, moda praia, protetor solar
- Pokémon TCG: cartas e boosters em alta constante no Brasil
- Games em alta: GTA 6 (lançamento de nov/2026), PS5 / PS5 Pro, Nintendo Switch 2, Xbox Series, controle DualSense — muito buscados, qualquer desconto real chama atenção
- Console PS5 (Slim/Pro): só é "barato" ABAIXO de R$4.000 — aí trate como preço excelente/imperdível. Acima de R$4.000 a oferta continua válida (não reprove por isso), mas destaque só o desconto em %, sem chamar de barato, "preço baixo" ou "menor preço"
- PC gamer / upgrade: placa de vídeo (RTX, Radeon), processador Ryzen/Intel, SSD NVMe, memória DDR5 — público entusiasta compara preço e compra quando cai
- Eletrônicos: sempre em alta, especialmente com desconto > 25%
- Nike e Adidas com descontos reais são excelentes conversores
Só cite uma tendência no texto se o produto tiver relação DIRETA com ela — nunca force (ex.: não associe capa de celular à Black Friday sem motivo).
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
  discount: string       // ex: "R$ 20 OFF" ou "10% OFF"
  effectivePrice: number // preço após cupom (só válido quando canApplyAlone = true)
  minValue?: number      // ex: 120 → compra mínima de R$120; undefined/0 = sem mínimo
  maxDiscount?: number   // ex: 50 → desconto limitado a R$50 (para cupons percentuais com teto)
  canApplyAlone: boolean // produto sozinho atinge o valor mínimo do cupom
}

// Anúncio com várias versões no título (AliExpress/Shopee: "SSD 128GB 256GB 512GB 1TB 2TB"):
// o preço lido é o da versão MAIS BARATA. Sem este aviso a IA escrevia "SSD 1TB por R$200"
// quando R$200 era o de 256GB. Celular "8GB RAM 256GB" (2 capacidades + RAM) não conta.
export function variantWarning(title: string): string {
  const gb = (c: string) => parseFloat(c.replace(',', '.')) * (/TB$/.test(c) ? 1024 : 1)
  const caps = [...new Set([...title.matchAll(/\b(\d+(?:[.,]\d+)?)\s?(gb|tb)\b/gi)].map(m => `${m[1]}${m[2].toUpperCase()}`))]
    .sort((a, b) => gb(a) - gb(b))
  const isRamPair = caps.length === 2 && /\b(ram|mem[oó]ria)\b/i.test(title)
  if (caps.length < 2 || isRamPair) return ''
  return `\nATENÇÃO — o anúncio tem VÁRIAS VERSÕES (${caps.join(', ')}) e o preço informado é o da versão MAIS BARATA (provavelmente ${caps[0]}). Nunca diga que a versão maior custa esse preço: no texto use "a partir de R$ X" e cite que é a versão de menor capacidade; avalie a oferta pelo preço da versão mais barata.\n`
}

export async function evaluateOffer(offer: RawOffer): Promise<OfferEvaluation> {
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const prompt = `Você é um especialista em ofertas e afiliados no Brasil. Data de hoje: ${today}.
${TRENDS_CONTEXT}
Avalie essa oferta de e-commerce com nota de 0 a 10.

Oferta:
- Título: ${offer.title}${variantWarning(offer.title)}
- Preço original: R$ ${offer.originalPrice}
- Preço com desconto: R$ ${offer.salePrice}
- Desconto: ${offer.discountPct}%
- Categoria: ${offer.category || 'não informada'}
- Avaliação: ${offer.rating || 'sem avaliação'}
${offer.sourceNote ? `- Post de um canal de promoções que garimpou essa oferta (o preço citado ali normalmente já é o FINAL com cupom/Pix, menor que o da loja — considere esse preço final como o desconto real):
"""${offer.sourceNote}"""` : ''}
Critérios de pontuação:
- Desconto ≥ 25% = +2 pontos
- Produto com avaliação ≥ 4 = +2 pontos
- Produto com relação direta a uma tendência atual (ver contexto acima) = +2 pontos
- Preço final ≤ R$100 (compra por impulso, converte muito) = +2 pontos
- Preço final entre R$100 e R$250 = +1 ponto
- Preço final acima de R$1.500 (compra planejada, converte pouco em canal de ofertas) = -2 pontos — EXCETO console, jogo lançamento ou peça de PC (produto hype): esses não perdem ponto pelo preço
- Produto hype (console, GTA 6, placa de vídeo, processador, SSD, DDR5) com qualquer desconto real ≥ 8% = +2 pontos
- Categoria popular (eletrônicos, moda, esporte, casa, beleza) = +1 ponto
- Item de uso diário e fácil de entender sem pesquisar (acessório, utilidade, cuidado pessoal, consumível) = +1 ponto

O canal privilegia ofertas FÁCEIS de comprar: ticket baixo, produto conhecido e útil. Eletrodoméstico grande ou eletrônico caro só merece nota alta se o desconto for realmente excepcional.

Como calcular: comece em 3, some/subtraia os critérios acima e limite entre 0 e 10. Use a escala inteira — a nota decide a ordem da fila de posts:
- 9–10: oferta excepcional (desconto real alto + produto muito desejado + preço baixo ou hype)
- 7–8: oferta boa
- 6: mediana, posta se sobrar espaço
- 0–5: não vale postar (shouldPost false)

Responda APENAS com JSON válido, sem markdown, no formato:
{"score": <nota de 0 a 10>, "shouldPost": <true se a nota for 6 ou mais>, "reason": "motivo breve"}`

  const text = await chat(prompt, 200)
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

- Título: ${offer.title}${variantWarning(offer.title)}
- Preço atual: R$ ${offer.salePrice}
- Desconto: ${offer.discountPct}%

Avalie:
1. Se o preço parece competitivo para o mercado brasileiro
2. Se o produto tem alta demanda neste momento (ver tendências acima)
3. Qual destaque usar no copy de vendas

Responda APENAS com JSON válido, sem markdown:
{"isCompetitive": true, "reason": "motivo curto", "suggestedHighlight": "Menor preço do mercado"}`

  const text = await chat(prompt, 250)
  try {
    return JSON.parse(stripMarkdown(text)) as MarketAnalysis
  } catch {
    return { isCompetitive: true, reason: 'Análise indisponível', suggestedHighlight: 'Oferta limitada' }
  }
}

export async function evaluateCouponOffer(offer: RawOffer, coupon: CouponContext): Promise<OfferEvaluation> {
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const maxDiscountNote = coupon.maxDiscount ? ` (teto de R$${coupon.maxDiscount.toFixed(2)})` : ''
  const priceInfo = coupon.canApplyAlone
    ? `- Preço com cupom aplicado: R$ ${coupon.effectivePrice.toFixed(2)}${maxDiscountNote}`
    : `- Preço do produto: R$ ${offer.salePrice.toFixed(2)} (cupom${coupon.minValue ? ` requer compra mínima de R$${coupon.minValue}` : ''} — o cliente pode combinar produtos no carrinho para atingir o valor)`

  const prompt = `Você é um especialista em ofertas e afiliados no Brasil. Data de hoje: ${today}.
${TRENDS_CONTEXT}
Avalie esse produto que possui um CUPOM DE DESCONTO EXCLUSIVO com nota de 0 a 10.

Produto:
- Título: ${offer.title}${variantWarning(offer.title)}
- Preço atual: R$ ${offer.salePrice.toFixed(2)}
- Desconto do cupom: ${coupon.discount}
${priceInfo}
- Cupom: ${coupon.code}
- Avaliação: ${offer.rating || 'sem avaliação'}
- Categoria: ${offer.category || 'não informada'}

Critérios de pontuação:
- Preço do produto ≤ R$100 = +3 pontos (bom para combo de carrinho)
- Preço do produto ≤ R$200 = +2 pontos
- Produto com relação direta a uma tendência atual (ver contexto acima) = +2 pontos
- Avaliação ≥ 4 estrelas = +2 pontos
- Categoria popular (eletrônicos, moda, esporte, suplementos) = +1 ponto
- Cupom exclusivo de afiliado = sempre +1 ponto (diferencial competitivo)

IMPORTANTE: O cupom aplica no CARRINHO TOTAL, não por produto isolado. Produtos abaixo do mínimo são ótimos para combinar com outros e ativar o cupom — isso NÃO penaliza a nota.

Como calcular: comece em 3, some os critérios acima e limite entre 0 e 10 (9–10 excepcional, 7–8 boa, 6 mediana, 0–5 não postar).

Responda APENAS com JSON válido, sem markdown, no formato:
{"score": <nota de 0 a 10>, "shouldPost": <true se a nota for 6 ou mais>, "reason": "motivo breve considerando o cupom"}`

  const text = await chat(prompt, 200)
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

  const discountLabel = coupon.maxDiscount
    ? `${coupon.discount} (máx R$${coupon.maxDiscount.toFixed(2)})`
    : coupon.discount
  const couponBlock = coupon.canApplyAlone
    ? `   💰 Preço: R$ ${offer.salePrice.toFixed(2)}
   🎟️ Cupom: <code>${coupon.code}</code> → <b>${discountLabel}</b>
   ✅ Você paga: <b>R$ ${coupon.effectivePrice.toFixed(2)}</b>`
    : `   💰 Preço: R$ ${offer.salePrice.toFixed(2)}
   🎟️ Cupom: <code>${coupon.code}</code> → <b>${discountLabel}</b> em compras na loja
   ⚠️ <i>Adicione ao carrinho com outros itens${coupon.minValue ? ` (mín. R$${coupon.minValue})` : ''} para ativar o cupom</i>`

  const whatsappCouponBlock = coupon.canApplyAlone
    ? `💰 R$ ${offer.salePrice.toFixed(2)} → use ${coupon.code} → R$ ${coupon.effectivePrice.toFixed(2)}${coupon.maxDiscount ? ` (máx R$${coupon.maxDiscount.toFixed(2)})` : ''}`
    : `💰 R$ ${offer.salePrice.toFixed(2)} | Cupom ${coupon.code} (${discountLabel})\n⚠️ Válido combinando itens no carrinho${coupon.minValue ? ` acima de R$${coupon.minValue}` : ''}`

  const prompt = `Você é um copywriter expert em ofertas para canais do Telegram e WhatsApp no Brasil.
Data: ${today}
${TRENDS_CONTEXT}

Produto com CUPOM EXCLUSIVO DE AFILIADO:
- Produto: ${offer.title}${variantWarning(offer.title)}
- Preço atual: R$ ${offer.salePrice.toFixed(2)}
- Cupom: ${coupon.code} (${coupon.discount})
${coupon.canApplyAlone
  ? `- Preço final com cupom: R$ ${coupon.effectivePrice.toFixed(2)} (cupom aplicável sozinho${coupon.maxDiscount ? `, teto R$${coupon.maxDiscount.toFixed(2)}` : ''})`
  : `- Cupom${coupon.minValue ? ` requer carrinho mínimo de R$${coupon.minValue}` : ''} — cliente pode combinar produtos`}
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

  const text = await chat(prompt, 900)
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

  const styles = ['urgente', 'informativo', 'entusiasmado']
  const style = styles[Math.floor(Math.random() * styles.length)]

  // Bloco de preço pré-formatado — o modelo NÃO deve inventar valores
  const priceBlock = offer.discountPct > 0
    ? `   💰 De: <s>R$ ${offer.originalPrice?.toFixed(2)}</s> → <b>R$ ${offer.salePrice.toFixed(2)}</b> (-${offer.discountPct}%)`
    : `   💰 <b>R$ ${offer.salePrice.toFixed(2)}</b>`
  const wpPriceLine = offer.discountPct > 0
    ? `💰 De R$${offer.originalPrice?.toFixed(2)} por R$${offer.salePrice.toFixed(2)} (-${offer.discountPct}%)`
    : `💰 R$${offer.salePrice.toFixed(2)}`

  const prompt = `Você é um copywriter expert em ofertas para canais do Telegram e WhatsApp no Brasil.
Data: ${today}
${TRENDS_CONTEXT}

Produto: ${offer.title}${variantWarning(offer.title)}
${offer.discountPct > 0 ? `Desconto: ${offer.discountPct}% OFF` : 'Produto sem desconto explícito'}
${couponCode ? `Cupom extra: ${couponCode}` : ''}
${suggestedHighlight ? `Destaque sugerido: ${suggestedHighlight}` : ''}
${offer.rating ? `Avaliação: ${offer.rating} ⭐` : ''}
${offer.sourceNote ? `Informações do post original (OBRIGATÓRIO incluir no texto o que for útil ao comprador: cupom e o preço final com cupom, condição de uso do cupom, "produto em inglês", loja; nunca cite o canal de origem):
"""${offer.sourceNote}"""` : ''}
Link: ${affiliateUrl}

Estilo desta mensagem: ${style}

Gere DUAS versões usando EXATAMENTE os blocos de preço abaixo (NÃO invente outros valores):

Telegram (use HTML: <b>, <i>, <s>, <code>, <a href="">):
🔥 <b>TÍTULO CHAMATIVO AQUI</b>
🛒 NOME DO PRODUTO (resumido, até 70 caracteres, sem código de modelo)

${priceBlock}
${couponCode ? `   🎟️ Cupom: <code>${couponCode}</code>` : ''}
${offer.sourceNote ? `   ✅ COM CUPOM/CONDIÇÃO: 1 linha com o preço final citado no post original e a condição (ex.: "R$ 140 usando o cupom", "resgate o cupom antes", "produto em inglês")` : ''}
${offer.rating ? `   ⭐ ${offer.rating}/5.0` : ''}

   👉 <a href="${affiliateUrl}">Comprar agora</a>

   📌 DESTAQUE (1 linha motivacional)

WhatsApp (apenas texto + emojis, sem HTML, máximo 6 linhas):
🔥 *NOME DO PRODUTO* (resumido, até 70 caracteres)
${wpPriceLine}
${couponCode ? `🎟️ Cupom: ${couponCode}` : ''}
${offer.sourceNote ? `✅ 1 linha com o preço final usando o cupom citado no post original e a condição, se houver` : ''}
👉 ${affiliateUrl}

Responda APENAS com JSON válido, sem markdown:
{"telegram": "mensagem telegram aqui", "whatsapp": "mensagem whatsapp aqui"}`

  const text = await chat(prompt, 800)
  try {
    return JSON.parse(stripMarkdown(text)) as GeneratedPost
  } catch {
    const fallback = `🔥 <b>${offer.title}</b>\n\n💰 De: <s>R$ ${offer.originalPrice?.toFixed(2)}</s> → <b>R$ ${offer.salePrice.toFixed(2)}</b> (-${offer.discountPct}%)\n\n👉 <a href="${affiliateUrl}">Comprar agora</a>`
    return { telegram: fallback, whatsapp: `🔥 ${offer.title}\nDe R$${offer.originalPrice?.toFixed(2)} por R$${offer.salePrice.toFixed(2)} (${offer.discountPct}% OFF)\n👉 ${affiliateUrl}` }
  }
}
