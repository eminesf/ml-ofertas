# ML Afiliados — Instruções para Claude Code

## Contexto do projeto
Monorepo `ml-afiliados` com backend Node.js + TypeScript e frontend Next.js.
Leia o `CLAUDE.md` na raiz para entender a arquitetura completa antes de começar.

O projeto já tem:
- Estrutura de pastas criada
- Schema Prisma com models `Offer`, `Coupon`, `Post`
- Provider base (`AffiliateProvider` interface)
- Scraper básico do ML funcionando (48 ofertas)
- Job pipeline esqueleto
- Canal Telegram esqueleto
- Frontend Next.js básico

---

## Tarefa principal

Implemente as funcionalidades abaixo **em ordem**. Após cada etapa, rode os testes antes de avançar.

---

## ETAPA 1 — Autenticação no Mercado Livre

Crie `packages/backend/src/providers/mercadolivre/auth.ts`.

O Mercado Livre usa login com email/senha + possível 2FA. Implemente:

```typescript
// Credenciais via .env
ML_EMAIL=
ML_PASSWORD=
```

- Use Playwright com `storageState` para salvar cookies/sessão em `packages/backend/.ml-session.json`
- Se o arquivo de sessão existir e for válido (checar se ainda está logado acessando `/afiliados/hub`), reutilize — não logue de novo
- Se sessão inválida ou inexistente, faça login em `https://www.mercadolivre.com.br/` clicando em "Entrar", preenchendo email e senha
- Salve a sessão após login bem-sucedido
- Adicione `.ml-session.json` ao `.gitignore`
- Exporte função `getAuthenticatedContext(): Promise<BrowserContext>`

---

## ETAPA 2 — Scraper de produtos recomendados (hub de afiliados)

Crie `packages/backend/src/providers/mercadolivre/scraper-hub.ts`.

Acesse `https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true` autenticado.

Colete produtos da seção "Produtos selecionados para você":
- Não precisa paginar até o fim — colete as **primeiras 3 páginas** de scroll (scroll down 3x com `page.evaluate(() => window.scrollBy(0, 1500))` + `waitForTimeout(2000)`)
- Para cada produto colete: título, preço, URL do produto, imagem, vendedor, comissão (se visível)
- Foque em categorias com boa comissão e tendência atual:
  - Figurinhas Copa do Mundo FIFA 26 (Panini)
  - Pokémon TCG (cartas, pacotes, booster)
  - Camisetas de seleção (Brasil, Portugal, Argentina)
  - Roupas Nike e Adidas
  - Eletrônicos com desconto > 25%
  - Qualquer produto com badge "Mais vendido"
- Filtre produtos fora dessas categorias usando palavras-chave no título
- Gere link de afiliado com `buildAffiliateLink()`
- Retorne array de `RawOffer`

---

## ETAPA 3 — Scraper de cupons gerados + produtos do cupom

Crie `packages/backend/src/providers/mercadolivre/scraper-coupons.ts`.

### 3a. Ler cupons gerados

Acesse `https://www.mercadolivre.com.br/afiliados/coupons#hub` autenticado.

Clique na aba "Códigos gerados" (seletor: `button` ou `a` com texto "Códigos gerados").

Para cada cupom na lista colete:
- Código do cupom (ex: `#FUCHS20OFF`)
- Desconto (ex: `R$20 OFF`)
- Data de vencimento — elemento: `<span class="...andes-typography--color-secondary...">Vence em 1 de julho</span>` — parse para `Date`
- Link "Ver produtos" — seletor: `a.generated-coupon-item__link` com texto "Ver produtos"

### 3b. Produtos de cada cupom

Para cada cupom, clique em "Ver produtos" (abre nova aba ou navega).

Colete os primeiros 20 produtos da página:
- título, preço, URL, imagem, vendedor
- gere link de afiliado

Avalie cada produto com IA (ver Etapa 4) antes de salvar.

### 3c. Persistir cupons no banco

Upsert na tabela `Coupon`:
```typescript
{
  provider: 'mercadolivre',
  code: '#FUCHS20OFF',
  discount: 'R$20 OFF',
  expiresAt: Date,   // parsed da string "Vence em 1 de julho" — use ano atual
  active: true,
  category: 'geral'
}
```

Desative (`active: false`) cupons cujo `expiresAt` já passou.

---

## ETAPA 4 — Avaliação e análise de mercado com IA

Atualize `packages/backend/src/ai/index.ts`.

### evaluateOffer() — já existe, melhorar

Adicione ao prompt contexto de tendência:
- Data atual
- Eventos em alta: Copa do Mundo FIFA 26 (junho/julho 2026), Pokémon TCG, temporada de inverno BR
- Considere comissão alta como fator positivo

### analyzeMarketValue() — função nova

```typescript
export async function analyzeMarketValue(offer: RawOffer): Promise<{
  isCompetitive: boolean
  reason: string
  suggestedHighlight: string // ex: "Menor preço do mercado", "Alta demanda agora"
}>
```

Prompt deve avaliar:
- Se o preço parece competitivo para o produto (use conhecimento de preços típicos no Brasil)
- Se o produto tem alta demanda no momento (Copa, Pokémon, etc.)
- Retornar `suggestedHighlight` para usar no copy

### generatePostMessage() — já existe, melhorar

Melhore o prompt para:
- Incluir `suggestedHighlight` no copy
- Variar o estilo (às vezes mais urgente "ÚLTIMAS HORAS", às vezes mais informativo)
- Gerar versão para **Telegram** (suporta HTML: `<b>`, `<i>`) e **WhatsApp** (só texto + emojis)
- Retornar ambas as versões:
```typescript
export interface GeneratedPost {
  telegram: string
  whatsapp: string
}
```

---

## ETAPA 5 — Persistência completa e deduplicação

Atualize `packages/backend/src/jobs/offers.job.ts`.

### Adicionar ao schema Prisma

```prisma
model Offer {
  // campos existentes +
  couponAmount     String?
  couponCode       String?   // código do cupom associado ex: "#FUCHS20OFF"
  couponExpiresAt  DateTime?
  suggestedHighlight String?
  telegramMessage  String?
  whatsappMessage  String?
  source           String    @default("offers-page") // "offers-page" | "hub" | "coupon"
}

model Post {
  // campos existentes +
  whatsappMessage  String?
  repostedAt       DateTime? // quando foi repostado
}
```

Rode `npx prisma migrate dev --name expand-offer-post` após atualizar o schema.

### Lógica de repost

Um post pode ser repostado no mesmo dia se:
- A oferta ainda não venceu (`couponExpiresAt` > now, ou sem vencimento)
- O último post dessa oferta foi há mais de 4 horas
- Não foi postado mais de 2x no mesmo dia

Adicione função `shouldRepost(offer: Offer): boolean` em `offers.job.ts`.

---

## ETAPA 6 — Bot do Telegram

Atualize `packages/backend/src/channels/telegram/index.ts`.

Implemente:

```typescript
// Envia mensagem de texto com HTML
export async function sendMessage(text: string): Promise<boolean>

// Envia foto com legenda HTML
export async function sendPhoto(imageUrl: string, caption: string): Promise<boolean>

// Envia múltiplas ofertas como media group (album)
export async function sendMediaGroup(offers: Array<{imageUrl: string, caption: string}>): Promise<boolean>
```

Variáveis de ambiente necessárias:
```env
TELEGRAM_BOT_TOKEN=   # obtido no @BotFather
TELEGRAM_CHANNEL_ID=  # @nomedocanal ou -100xxxxxxxxx
```

Formato da mensagem Telegram (HTML):
```
🔥 <b>TÍTULO DO PRODUTO</b>

💰 De: <s>R$ 399,00</s> → <b>R$ 249,00</b> (-38%)
🎟️ Cupom: <code>#FUCHS20OFF</code> (R$20 extra OFF)
⭐ Avaliação: 4.8 (2.341 avaliações)
🚚 Frete grátis

👉 <a href="LINK_AFILIADO">Comprar agora</a>

📌 Menor preço do mercado • Copa do Mundo
```

---

## ETAPA 7 — Scheduler completo

Atualize `packages/backend/src/jobs/scheduler.ts`.

Crie três jobs separados:

```typescript
// Job 1 — Ofertas públicas (página /ofertas) — a cada 3h
cron.schedule('0 */3 * * *', () => runOffersJob(providers))

// Job 2 — Hub de afiliados + cupons (requer login) — 2x por dia
cron.schedule('0 8,18 * * *', () => runHubJob(providers))

// Job 3 — Repost de ofertas válidas — a cada 6h
cron.schedule('0 */6 * * *', () => runRepostJob())
```

`runHubJob`:
1. `getAuthenticatedContext()` — sessão autenticada
2. `scrapeHubProducts()` — produtos do hub
3. `scrapeCouponsAndProducts()` — cupons + produtos
4. Para cada produto: `analyzeMarketValue()` + `evaluateOffer()`
5. Salva no banco com `source: 'hub'` ou `source: 'coupon'`
6. Posta os melhores no Telegram

`runRepostJob`:
1. Busca offers com `posts` do dia atual com `success: true`
2. Para cada uma, checa `shouldRepost()`
3. Se sim, gera novo copy com IA e reposta

---

## ETAPA 8 — Frontend Next.js (estilo Pelando/Buscapé)

Reescreva o frontend em `packages/frontend/src/`.

### Páginas

**`/` — Home**
- Header com logo + barra de busca + categorias
- Banner de destaque (oferta com maior aiScore do dia)
- Grid de ofertas em cards
- Filtros: categoria, desconto mínimo, provider, ordenar por (maior desconto, mais recente, melhor avaliado)
- Paginação (não infinita — botão "Ver mais")

**`/oferta/[id]` — Detalhe da oferta**
- Imagem grande
- Título, preços, desconto em destaque
- Botão CTA "Ver oferta" → link afiliado (abre nova aba)
- Cupom copiável se houver
- Texto gerado pela IA como descrição
- Ofertas relacionadas (mesma categoria)

**`/categoria/[slug]` — Listagem por categoria**
- Mesma grid da home filtrada por categoria

### Design
- Cores: amarelo ML (#FFE600) como accent, branco como base, cinza escuro para texto
- Card de oferta deve ter: imagem, badge de desconto em vermelho, título (2 linhas max), preço riscado + preço atual em destaque, badge de cupom se houver, botão "Ver oferta"
- Mobile-first, responsivo
- Sem biblioteca de componentes — CSS modules ou styled-jsx apenas

### API routes Next.js (para SSR/ISR)
O frontend deve consumir o backend em `NEXT_PUBLIC_API_URL`. Use `fetch` com `{ next: { revalidate: 300 } }` para cache de 5 minutos.

---

## ETAPA 9 — Seed de cupons manuais

Crie `packages/backend/src/seed-coupons.ts`.

Script para inserir cupons manualmente no banco:

```typescript
const coupons = [
  {
    code: '#FUCHS20OFF',
    discount: 'R$20 OFF',
    provider: 'mercadolivre',
    expiresAt: new Date('2026-07-01'),
    active: true,
    category: 'geral',
  },
  // adicione seus outros cupons aqui
]
```

Rode com: `npx tsx src/seed-coupons.ts`

---

## ETAPA 10 — Variáveis de ambiente finais

Certifique-se que o `.env` tem todos os campos:

```env
# Anthropic
ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=

# ML Afiliados
ML_AFFILIATE_ID=28042140
ML_AFFILIATE_WORD=fuchsecommerce
ML_EMAIL=
ML_PASSWORD=

# App
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Restrições importantes

1. **Mantenha tudo dentro do provider `mercadolivre`** — não generalize para outros providers ainda. A interface `AffiliateProvider` deve continuar suportando múltiplos providers no futuro, mas só implemente ML agora.

2. **Não modifique a interface `AffiliateProvider` em `base.provider.ts`** — apenas adicione métodos específicos no provider ML se necessário.

3. **Sessão do ML** — o arquivo `.ml-session.json` nunca vai para o git. Trate erros de sessão expirada com re-login automático.

4. **Erros não devem derrubar o job** — use try/catch em cada oferta individualmente. Se uma falhar, continue para a próxima.

5. **Rate limiting** — aguarde 1-2s entre requests ao ML e 1s entre mensagens no Telegram para não ser bloqueado.

6. **Conformidade ML Afiliados**:
   - Poste apenas em canais públicos cadastrados
   - Não compre pelos próprios links
   - Não gere tráfego artificial

---

## Ordem de execução dos testes

Após implementar cada etapa, teste antes de avançar:

```bash
# Etapa 1 — auth
npx tsx src/providers/mercadolivre/auth.ts

# Etapa 2 — hub scraper
npx tsx src/test-hub.ts

# Etapa 3 — coupons scraper  
npx tsx src/test-coupons.ts

# Etapa 4 — IA
npx tsx src/test-ai.ts

# Etapa 7 — job completo
npx tsx src/jobs/scheduler.ts --now

# Frontend
cd ../frontend && npm run dev
```

---

## Arquivos de teste a criar

Para cada etapa, crie um arquivo `src/test-[etapa].ts` simples com `async function main()` que testa a funcionalidade isolada e imprime o resultado no console.