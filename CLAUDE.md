# ML Afiliados Bot — Contexto do Projeto

## O que é
Bot automatizado de ofertas para afiliados do Mercado Livre. Scrapa ofertas públicas do ML, avalia com IA (Claude), gera copy chamativo e posta em canal público do Telegram. Site Next.js exibe as ofertas como feed estilo pelando.com.br e serve como plataforma cadastrada no programa de afiliados.

## Stack
- **Monorepo** npm workspaces
- **Backend**: Node.js + TypeScript + Express + Prisma + SQLite + node-cron + Playwright
- **Frontend**: Next.js 15 (App Router) — SSR + client components para interatividade
- **IA**: Claude API (`claude-haiku-4-5`) via `@anthropic-ai/sdk@^0.105.0` — escolhido por custo (~3x mais barato que Sonnet, ~$0.05/run, ~$5 dura ~12-18 dias)
- **Canal**: Telegram Bot API (REST)
- **Hospedagem futura**: Railway (backend) + Vercel (frontend)

## Estrutura de pastas
```
ml-afiliados/
├── packages/
│   ├── backend/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── providers/
│   │       │   ├── base.provider.ts              # interface AffiliateProvider (name, scrapeOffers, buildAffiliateLink)
│   │       │   └── mercadolivre/
│   │       │       ├── index.ts                  # scraper público /ofertas
│   │       │       ├── auth.ts                   # login ML + sessão salva
│   │       │       ├── scraper-hub.ts            # scraper /afiliados/hub
│   │       │       └── scraper-coupons.ts        # scraper /afiliados/coupons
│   │       ├── jobs/
│   │       │   ├── offers.job.ts                 # pipeline: scrape, IA, posting, repost
│   │       │   └── scheduler.ts                  # cron jobs agendados
│   │       ├── ai/index.ts                       # evaluateOffer + analyzeMarketValue + generatePostMessage
│   │       ├── channels/telegram/index.ts        # sendMessage + sendPhoto
│   │       ├── api/routes/
│   │       │   ├── offers.ts                     # GET /api/offers + POST /vote + POST /downvote
│   │       │   └── posts.ts                      # GET /api/posts
│   │       ├── utils/prisma.ts                   # singleton PrismaClient
│   │       └── index.ts                          # Express entry point (porta 3001)
│   └── frontend/
│       └── src/
│           ├── app/
│           │   ├── globals.css                   # reset box-sizing + hide CTA em mobile (<520px)
│           │   ├── layout.tsx                    # header amarelo, footer, importa globals.css
│           │   ├── page.tsx                      # feed lista com tabs de ordenação (SSR)
│           │   ├── oferta/[id]/page.tsx          # página de detalhe com VoteButton (SSR)
│           │   └── categoria/[slug]/page.tsx     # feed filtrado por categoria (SSR)
│           ├── components/
│           │   ├── OfferCard.tsx                 # card horizontal estilo pelando (server component)
│           │   ├── VoteButton.tsx                # botão de upvote com localStorage ('use client')
│           │   ├── CouponCopy.tsx                # badge/box de cupom com copy para clipboard ('use client')
│           │   ├── WelcomeModal.tsx              # modal primeira visita + link Telegram ('use client')
│           │   └── Filters.tsx                   # (legado — não usado; pode remover)
│           └── lib/api.ts                        # fetch do backend + tipos Offer/Post + voteOffer()
├── .env
├── .ml-session.json                              # sessão ML salva pelo auth (gerado em runtime)
└── package.json                                  # concurrently dev
```

## Variáveis de ambiente (.env)
```env
ANTHROPIC_API_KEY=            # configurado ✅ — $5 de crédito, modelo claude-haiku-4-5
TELEGRAM_BOT_TOKEN=           # configurado ✅ — bot criado via @BotFather
TELEGRAM_CHANNEL_ID=@e_foxofertas  # canal público criado e testado ✅
ML_AFFILIATE_ID=28042140      # matt_tool do ML Afiliados
ML_AFFILIATE_WORD=fuchsecommerce   # matt_word / prefixo do afiliado
ML_EMAIL=                     # login ML para hub/cupons
ML_PASSWORD=                  # senha ML para hub/cupons (opcional — ML pode logar por WhatsApp/QR)
ML_HUB_MAX_PRODUCTS=50        # máximo de produtos a coletar do hub (padrão 50, pode reduzir para testes)
ML_POST_MAX=3                 # máximo de posts por rodada do cron (a cada 20min, padrão 3)
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Banco de dados (SQLite via Prisma)
Arquivo: `packages/backend/prisma/dev.db`

```prisma
model Offer {
  id                 String    @id @default(cuid())
  externalId         String    @unique   // MLB123456
  provider           String             // "mercadolivre"
  title              String
  originalPrice      Float
  salePrice          Float
  discountPct        Int
  imageUrl           String?
  productUrl         String
  affiliateUrl       String
  category           String?
  rating             Float?
  aiScore            Int?               // 0-10 avaliação da IA (null = ainda não avaliado)
  couponAmount       String?            // "R$30 OFF" — cupom embutido no card
  couponCode         String?            // "#FUCHS20OFF" — cupom do painel
  couponExpiresAt    DateTime?
  suggestedHighlight String?            // destaque sugerido pela IA
  telegramMessage    String?            // copy gerado — null = pendente de geração
  whatsappMessage    String?
  source             String             // "offers-page" | "hub" | "coupon"
  upvotes            Int       @default(0)  // votos da comunidade no site
  createdAt          DateTime  @default(now())
  posts              Post[]
}

model Coupon {
  id         String    @id @default(cuid())
  provider   String
  code       String                // ex: "#FUCHS20OFF"
  discount   String                // "R$ 20 OFF"
  minValue   Float?
  category   String?
  expiresAt  DateTime?
  active     Boolean   @default(true)
  createdAt  DateTime  @default(now())
  @@unique([code, provider])
}

model Post {
  id              String    @id @default(cuid())
  offerId         String
  offer           Offer     @relation(fields: [offerId], references: [id])
  channel         String    // "telegram"
  message         String
  whatsappMessage String?
  sentAt          DateTime  @default(now())
  repostedAt      DateTime?
  success         Boolean   @default(true)
}
```

## Classificação automática de categorias

O ML não expõe categoria por produto no listing. A classificação é feita por palavras-chave no título, em `src/utils/category.ts`, função `classifyCategory(title: string): string`.

### Categorias disponíveis
| Slug | Label no frontend |
|---|---|
| `eletronicos` | Eletrônicos |
| `esporte` | Esporte e Suplementos |
| `moda` | Moda e Acessórios |
| `casa` | Casa e Eletrodomésticos |
| `beleza` | Beleza e Cuidados |
| `automotivo` | Automotivo |
| `ferramentas` | Ferramentas |
| `geral` | fallback — nenhum keyword bateu |

### Onde é chamada
Em `processOffer` (offers.job.ts), antes de salvar no banco:
```typescript
const category = (!raw.category || raw.category === 'geral')
  ? classifyCategory(raw.title)
  : raw.category
```
Isso cobre scrape novo, upsert por preço atualizado, **e backfill automático**: se a oferta já existe no banco sem categoria, o next scrape classifica sem precisar rodar nenhum script separado.

### Cuidados com os keywords
- Usar `'tablet '` (com espaço) e não `'tablet'` para evitar falso positivo em "Multivitamin X **tablet**es"
- Verificar se um keyword curto pode ser substring de outra palavra antes de adicionar
- Após adicionar keywords, testar com `SELECT title, category FROM Offer WHERE category = 'geral' LIMIT 20` no Prisma Studio

### Adicionando/ajustando categorias
Edite o array `RULES` em `packages/backend/src/utils/category.ts`. A ordem importa: o primeiro match vence.

## API REST (backend Express — porta 3001)

### GET /api/offers
Parâmetros: `provider`, `category`, `page`, `limit` (padrão 20, máx 100), `minDiscount`, `sort`

Valores de `sort`:
- `recent` (padrão) → `createdAt DESC`
- `votes` → `upvotes DESC` (mais votadas pela comunidade)
- `discount` → `discountPct DESC`
- `score` → `aiScore DESC`

Resposta: `{ offers, total, page, limit }` — cada oferta inclui o campo `upvotes`.

### POST /api/offers/:id/vote
Incrementa `upvotes` em 1. Resposta: `{ upvotes: number }`

### POST /api/offers/:id/downvote
Decrementa `upvotes` em 1 (pode ir negativo). Resposta: `{ upvotes: number }`

### GET /api/offers/:id
Retorna oferta completa com todos os posts.

### GET /api/posts
Lista posts do Telegram.

### POST /api/offers/import *(a implementar)*
Recebe uma URL de produto do Mercado Livre, scrapa os dados, salva no banco e executa o pipeline completo de IA + posting no Telegram.

**Body (JSON):**
```json
{
  "url": "https://www.mercadolivre.com.br/p/MLB64311324",
  "couponCode": "#FUCHS20OFF",
  "couponDiscount": "R$ 20 OFF",
  "couponMinValue": 120
}
```
- `url` — obrigatório. URL do produto no ML (formato `/p/MLBXXXXXXX` ou `/MLB-XXXXXXX-...`)
- `couponCode` — opcional. Código do cupom do afiliado (ex: `#FUCHS20OFF`)
- `couponDiscount` — opcional, mas obrigatório se `couponCode` presente. Texto do desconto (ex: `"R$ 20 OFF"`)
- `couponMinValue` — opcional. Valor mínimo do carrinho para ativar o cupom (ex: `120`)

**Fluxo esperado:**
1. Extrai `externalId` da URL via regex `MLB-?(\d+)` → normaliza como `MLB{digits}`
2. Abre Playwright headless, navega até a URL e scrapa: título, preço atual, preço original, desconto %, imagem, avaliação
3. Classifica categoria via `classifyCategory(title)`
4. Constrói `affiliateUrl` com `matt_tool` e `matt_word`
5. Se `couponCode` presente: usa `evaluateCouponOffer` + `generateCouponPostMessage` com `CouponContext` montado a partir do body; persiste cupom na tabela `Coupon`
6. Se sem cupom: usa `evaluateOffer` + `generatePostMessage` normais
7. Salva `Offer` no banco com `source = "manual"`
8. Dispara `runPostingJob` para postar imediatamente no Telegram
9. Resposta: `{ offer, posted: boolean }`

**Erros esperados:**
- `400` se `url` inválida ou `externalId` não encontrado
- `409` se oferta já existe no banco com mesmo `externalId` (retorna a oferta existente)
- `422` se `couponCode` fornecido sem `couponDiscount`

## Frontend — Feed estilo pelando.com.br

### Layout geral
- Header amarelo (#FFE600) com logo e navegação por categoria
- Feed vertical com 20 ofertas por página (SSR via Next.js)
- Paginação numérica com reticências inteligente (`buildPageNumbers`)
- Background cinza (#f0f0f0), cards brancos com borda sutil
- **Fonte**: Nunito (Google Fonts via `next/font/google`) — pesos 400/600/700/800/900, self-hosted pelo Next.js
- **Telegram FAB**: botão flutuante fixo no canto inferior direito (`position: fixed`, 56×56px, `#229ED9`), SVG inline, hover via `.telegram-fab:hover` em CSS
- **WelcomeModal**: modal de boas-vindas na primeira visita — localStorage key `fox_welcomed`; auto-fecha em 5s com barra de progresso animada; link direto para o canal Telegram; `animation: fadeIn + slideUp` via `@keyframes` em globals.css

### Tabs de ordenação (page.tsx)
Quatro tabs no topo do feed, alteram `?ordenar=` na URL (full page navigation, sem JS):
- 🕐 **Novos** (`ordenar=recent`) — padrão
- 🔥 **Quentes** (`ordenar=votes`) — mais upvotes
- **% Descontos** (`ordenar=discount`) — maior desconto
- **⭐ IA Score** (`ordenar=score`) — melhor avaliado pela IA

### OfferCard (horizontal, server component)
Layout em 4 colunas:
```
| VoteButton | Imagem (110px) | Info (flex) | Botão "Ver oferta →" |
```
- **VoteButton**: coluna de 58px, fundo #fafafa
- **Imagem**: link para `/oferta/:id`, 110×110px, objectFit contain
- **Info**: link para `/oferta/:id`, contém badges, título (2 linhas clampadas), preço, meta (rating + timeAgo + destaque IA)
- **CTA "Ver oferta →"**: link para `/oferta/:id` (página interna), fundo #FFE600, classe `.btn-cta`, hidden em mobile (<520px via CSS class `offer-cta`)

Badges exibidos:
- `-X% OFF` (vermelho) — sempre
- `🎟️ Cupom` (âmbar) — `<CouponCopy variant="badge" />`, clicável: copia código para clipboard, feedback "✓ Copiado!" por 2s
- `⭐ IA X/10` (verde) — apenas se `aiScore >= 8`

### VoteButton (client component — 'use client')
- Botão ▲ que incrementa/decrementa `upvotes` via `POST /api/offers/:id/vote` ou `/downvote`
- **Estado persistido em localStorage** — chave `vote_{offerId}`, valor `'1'`
- Toggle: clicar novamente desfaz o voto (chama downvote e remove do localStorage)
- Cor do contador baseada em temperatura:
  - `> 10` upvotes → laranja escuro (#ea580c) — oferta quente
  - `1-10` upvotes → laranja (#f97316)
  - `0` → cinza (#bbb)
  - `< 0` → azul (#3b82f6)
- Exibe `N°` (com símbolo de grau, referência à temperatura do pelando)
- CORS já habilitado no backend (`app.use(cors())`), chamada direta para `NEXT_PUBLIC_API_URL`

**Limitações atuais do sistema de votos:**
- Validação apenas no browser (localStorage) — sem autenticação server-side
- Mesmo usuário pode votar em modo anônimo, outro browser ou via `curl` diretamente
- Decisão: manter simples por ora; proteção server-side (rate limit ou tabela `Vote`) será implementada junto com autenticação

### CouponCopy (client component — 'use client')
Componente reutilizável em `src/components/CouponCopy.tsx` com dois modos:
- `variant="badge"` — badge compacto usado nos cards do feed; clique copia o código e exibe "✓ Copiado!" por 2s
- `variant="box"` — bloco de cupom na página de detalhe; código clicável com feedback visual completo (fundo verde, borda verde, texto muda)
- Fallback via `document.execCommand('copy')` para browsers sem `navigator.clipboard`
- `e.stopPropagation()` no badge evita navegar para a página do produto ao clicar no cupom

### timeAgo (utilitário inline em OfferCard.tsx)
```typescript
function timeAgo(dateStr: string): string
// < 60s → "agora"
// < 1h  → "Xmin atrás"
// < 1d  → "Xh atrás"
// < 7d  → "Xd atrás"
// else  → data localizada pt-BR
```

### Página de detalhe (/oferta/:id)
- Layout 2 colunas: imagem à esquerda, detalhes à direita
- VoteButton centralizado abaixo da imagem com texto "Essa oferta é boa?"
- Badge de aiScore visível
- `<CouponCopy variant="box" />` — código de cupom clicável, copia para clipboard
- CTA externo para `affiliateUrl` (abre em nova aba), classe `.btn-cta`
- Seção "Ofertas relacionadas" em lista vertical (4 cards)

### Hover em botões (.btn-cta)
Classe CSS em `globals.css`:
```css
.btn-cta:hover  { background: #e6c800 !important; transform: translateY(-1px); }
.btn-cta:active { transform: translateY(0); }
```
Aplicada em: botão "Ver oferta →" no card, botão "🛒 Ver oferta no Mercado Livre →" na página de detalhe.

### Favicon
- `app/icon.png` (32×32) — favicon do browser, gerado via `System.Drawing` do .NET a partir do `logo_png.png`
- `app/apple-icon.png` (180×180) — Apple touch icon
- Next.js App Router detecta automaticamente e injeta `<link rel="icon">` e `<link rel="apple-touch-icon">` no `<head>` sem configuração extra

### Fetch sem cache (lib/api.ts)
Todas as chamadas usam `{ cache: 'no-store' }` — garante dados frescos a cada carregamento de página.
**Bug resolvido:** com `{ next: { revalidate: 300 } }` (anterior), o Next.js cacheava a resposta por 5 minutos — após votar, F5 mostrava o contador zerado porque o SSR servia o cache stale.

## Pipeline — Scraping (offers.job.ts → processOffer)
O scraping é **separado do posting**. O job de scrape só salva no banco.

Cada etapa é logada com tag `[Job][MLB123][source]`:

1. Verifica se oferta já existe com **mesmo preço** → loga "Preço inalterado, pulando"
2. Se preço mudou ou é nova → **salva bruta no banco** → loga "Salvo no banco: título | preço | desconto"
3. Filtra desconto < 20% (`MIN_DISCOUNT`) → loga "Filtrado: desconto X% abaixo do mínimo"
   - **Exceção:** `source === 'coupon'` bypassa esse filtro (desconto é o próprio cupom)
4. Checa se já tem Post → loga "Filtrado: já tem post registrado"
5. `evaluateOffer()` → loga "IA score: X/10 [APROVADO/REPROVADO] — motivo"
6. Salva `aiScore` no banco independente do resultado
7. Descarta score < 6 (`MIN_AI_SCORE`) → para aqui
8. `analyzeMarketValue()` → loga "Análise de mercado: destaque sugerido"
9. `generatePostMessage()` → gera copy Telegram e WhatsApp
10. Atualiza `Offer` com `telegramMessage`, `whatsappMessage`, `suggestedHighlight`
11. Loga "✓ Copy gerado — pronto para posting"

Ao final do `runHubJob`, imprime resumo:
```
[Job] === RESUMO ===
[Job] Total no banco: 20 ofertas (hub: 16, cupom: 4)
[Job] Prontas para posting: 5
```

## Cupons no banco de dados
- `Offer.couponCode` = código do cupom (ex: `#FUCHS20OFF`) — linkado ao produto
- `Offer.couponAmount` = texto de cupom embutido no card do ML (ex: `R$30 OFF`)
- `Offer.couponExpiresAt` = expiração do cupom
- `Coupon.discount` = desconto textual do cupom gerado pelo afiliado (ex: `R$ 20 OFF`) — fica na tabela `Coupon`, não na `Offer`
- Para saber o desconto de um produto de cupom: join `Offer.couponCode` com `Coupon.code`

## Pipeline — Posting (offers.job.ts → runPostingJob)
Job de posting busca ofertas prontas e as posta de forma cadenciada:

1. Busca `Offer` com `telegramMessage NOT NULL`, `aiScore >= 6`, sem nenhum `Post`
2. Ordena por `aiScore` DESC, pega até `maxPosts` (padrão: 2)
3. `sendPhoto()` ou `sendMessage()` no Telegram
4. Salva `Post` no banco
5. Pausa 2s entre posts

## Agendamento (scheduler.ts)
```
6h diário    → job:offers  — scrape /ofertas públicas (48 produtos) → salva no banco
7h diário    → job:hub     — scrape /afiliados/hub (até 50 produtos, "Mais vendidos") → salva no banco
a cada 20min → job:post    — posta até 3 ofertas pendentes no Telegram
12h e 20h    → job:repost  — repost de ofertas antigas (máx 2x/dia por oferta)
```

## Scraper ML — Detalhes técnicos

### Scraper público (/ofertas)
- `headless: true` + user-agent real + `AutomationControlled` desativado
- Usa `page.evaluate()` com string inline (não `$$eval`) para evitar bug `__name` do tsx/esbuild
- **Testado ✅** — retorna 48 ofertas por execução
- Seletores confirmados:
  - Cards: `.poly-card`
  - Título/link: `a.poly-component__title`
  - Preço original: `s.andes-money-amount--previous` → `.andes-money-amount__fraction` + `.andes-money-amount__cents`
  - Preço atual: `.poly-price__current .andes-money-amount--cents-superscript`
  - Desconto: `.poly-price__disc_label` (ex: "27% OFF")
  - Imagem: `.poly-component__picture`
  - Avaliação: `.poly-reviews__rating`
  - Cupom no card: `.poly-coupons__pill`
- `externalId` extraído via regex `MLB-?(\d+)` → normalizado como `MLB{digits}` (suporta `MLB-XXXXXXX` e `MLBXXXXXXX`)

### Scraper hub (/afiliados/hub)
- Requer login autenticado
- Clica no botão `#best_seller` ("Mais vendidos") após carregar, aguarda `networkidle`
- **Virtual scrolling**: ML mantém apenas ~30 cards no DOM por vez, removendo os que saem de vista
- Solução: **coleta incremental** — a cada scroll de 800px extrai os cards visíveis e armazena em `Map` por `externalId` para deduplicar
- Para quando acumula `MAX_PRODUCTS` (50) ou 4 rounds sem cards novos
- Extração de preço via `parseBRL()` — usa `textContent` do elemento e regex, mais robusto que extrair fraction/cents separados
- Filtro de keywords removido — a IA filtra por score

### Auth ML (auth.ts)
- Salva sessão em `.ml-session.json` na raiz do projeto
- Verifica sessão existente navegando para `/afiliados/hub` — reutiliza se válida
- **Primeiro login: `headless: false`** para interação manual (browser visível)
- Fluxo de login atual do ML: email → verificação por WhatsApp code → QR code → logado (sem etapa de senha)
- Usa `Promise.race` entre `waitForSelector('#password, ...)` e `waitForURL(url_logado)` — suporta login com senha E sem senha
- Timeout de 5 minutos para o usuário completar verificações manualmente

### Scraper cupons (/afiliados/coupons)
- Requer login autenticado
- Seletores do HTML real confirmados:
  - Container: `[class*="generated-coupon-item__details"]`
  - Código: tag `<b>` dentro do container (ex: `#FUCHS20OFF`)
  - Desconto: `[class*="inner-details-title"]` (ex: "R$ 20 OFF")
  - Validade: `[class*="expiration"] span` (ex: "Vence em 1 de julho")
  - Link produtos: `a.generated-coupon-item__link` — **sem `href`**, requer clique
  - Condições: `[class*="modal-trigger"]` — abre modal com texto completo das regras
- **Extração do valor mínimo via modal** (`getCouponMinValue`):
  - Clica em "Condições do cupom" (span `[class*="modal-trigger"]`) para abrir o modal
  - Lê o texto do modal: selector `[class*="andes-modal"] [class*="andes-typography--size-m"]`
  - Extrai valor mínimo com regex: `/igual ou superior a R\$\s*([\d.]+)/i`
  - Fecha o modal com `Escape` antes de prosseguir
  - Mais confiável que URL — funciona para qualquer valor, mesmo que a URL mude de formato
- Fluxo de scraping de produtos (`scrapeProductsFromNewTab`):
  - Lê condições do cupom (modal) **antes** de abrir a aba de produtos
  - Usa a **mesma página** já carregada com aba "Códigos gerados" ativa — não reabre nova navegação
  - Clica no link "Ver produtos" pelo índice, aguarda nova aba via `ctx.waitForEvent('page')`
  - Scrapa produtos da nova aba com `PRODUCT_SCRIPT` e fecha a aba
  - Repete para cada cupom sem renavegar a página principal
- Persiste cupons na tabela `Coupon` (upsert por `[code, provider]`), incluindo `minValue`
- `test:hub` cobre hub + cupons — exibe cupons e primeiros 3 produtos de cada

## IA (ai/index.ts)
- Modelo: `claude-haiku-4-5`
- SDK: `@anthropic-ai/sdk@^0.105.0` (atualizado de 0.39 — corrige bug `ERR_STREAM_PREMATURE_CLOSE`)
- Todas as respostas passam por `stripMarkdown()` antes de `JSON.parse` — Haiku às vezes retorna JSON dentro de ``` ```json ``` ```
- Contexto de tendências injetado em todos os prompts (Copa FIFA 26, Pokémon TCG, inverno BR)

### Funções para ofertas normais (hub / offers-page)
- `evaluateOffer(offer)` → score 0-10 baseado em desconto, avaliação, tendências, preço
- `analyzeMarketValue(offer)` → competitividade e destaque sugerido
- `generatePostMessage(offer, url, couponCode?, highlight?)` → copy Telegram + WhatsApp

### Funções exclusivas para produtos de cupom
Produtos de `source === 'coupon'` usam funções especializadas que recebem `CouponContext`:
```typescript
interface CouponContext {
  code: string          // "#FUCHS20OFF"
  discount: string      // "R$ 20 OFF"
  effectivePrice: number // preço após cupom — só válido quando canApplyAlone = true
  minValue?: number     // ex: 120 → compra mínima de R$120 no carrinho
  canApplyAlone: boolean // true = produto sozinho atinge o mínimo; false = precisa combinar no carrinho
}
```
- `evaluateCouponOffer(offer, coupon)` → avalia pelo produto + contexto do cupom, +1 ponto fixo pelo diferencial de cupom exclusivo. O `minValue` **não penaliza** a nota — produtos abaixo do mínimo são incentivados como âncoras de carrinho.
- `generateCouponPostMessage(offer, url, coupon, highlight?)` → copy adaptado por `canApplyAlone`:
  - `canApplyAlone = true` → mostra "Você paga: R$X" (preço final com cupom)
  - `canApplyAlone = false` → mostra "Adicione ao carrinho com outros itens da loja para ativar o cupom (mín. R$X)"
- `analyzeMarketValue` é compartilhada entre os dois fluxos

**Cálculo de `effectivePrice` e `canApplyAlone` em `processOffer`:**
```typescript
const canApplyAlone = !couponMinValue || raw.salePrice >= couponMinValue
const effectivePrice = canApplyAlone
  ? Math.max(0, raw.salePrice - parseCouponDiscount(couponDiscount))
  : raw.salePrice  // cupom não aplica ao produto isolado — preço fica o mesmo
```
Isso corrige o bug de `R$19.90 - R$20 = R$0` para produtos abaixo do mínimo (ex: coqueteleira R$19,90 com cupom de R$20 OFF e mínimo R$120).

## Links de afiliado
Formato: `URL_PRODUTO?matt_tool=28042140&matt_word=fuchsecommerce`
Exemplo: `https://www.mercadolivre.com.br/p/MLB64311324?matt_tool=28042140&matt_word=fuchsecommerce`

## Cupons personalizados
- Criados no painel: `mercadolivre.com.br/afiliados/coupons#hub`
- Prefixo: `#FUCHS` + sufixo (ex: `#FUCHS20OFF`)
- Limite de 9 códigos ativos simultâneos
- O scraper de cupons busca automaticamente os produtos de cada cupom clicando em "Ver produtos"

### Semântica do cupom ML
O cupom aplica sobre o **total do carrinho**, não por produto individual. Regras reais extraídas do modal de condições:
- Cupom válido para compras cujo valor seja **igual ou superior a R$120** (valor lido do modal)
- Caso o cliente precise de 2+ produtos para atingir o mínimo, deve adicioná-los em um único carrinho e ativar o cupom antes de pagar
- Limite: 1 uso por CPF, não transferível
- Não acumula com outros cupons (o maior desconto é aplicado)

**Impacto no pipeline:**
- Produto acima do mínimo (ex: hipercalórico R$129,90): `canApplyAlone = true` → copy mostra "Você paga: R$109,90"
- Produto abaixo do mínimo (ex: creatina R$39,90): `canApplyAlone = false` → copy instrui a combinar itens no carrinho

## Conformidade ML Afiliados
- ✅ Canais públicos (Telegram Canal + site Next.js)
- ✅ Plataformas devem ser cadastradas no painel de afiliados
- ❌ Grupos privados não são permitidos
- ❌ Uso de bots para tráfego não orgânico não permitido
- ❌ Compras pelos próprios links não permitidas

## Como rodar
```bash
# Instalar deps
npm install

# Banco (primeira vez)
cd packages/backend
npx prisma migrate dev --name init
npx prisma generate

# Dev (backend 3001 + frontend 3002)
cd ../..
npm run dev
```

**Nota Windows:** `prisma generate` pode falhar com EPERM se o backend estiver rodando (DLL travada pelo processo Node). Pare o servidor, gere, depois suba novamente. Os tipos TypeScript são gerados antes do erro do DLL — verificar com `Select-String -Path node_modules/.prisma/client/index.d.ts -Pattern "campo_novo"`.

### Scripts disponíveis (dentro de `packages/backend`)

```bash
# --- Servidor ---
npm run dev           # backend em modo watch (porta 3001)
npm run build         # compila TypeScript
npm run start         # roda build compilado

# --- Banco de dados ---
npm run db:migrate    # aplica migrations Prisma
npm run db:generate   # gera cliente Prisma
npm run db:studio     # abre UI visual do banco (localhost:5555)

# --- Testes de integração (só diagnóstico, não salva nada) ---
npm run test:scraper  # scraper público ML — 48 ofertas, sem login
npm run test:hub      # hub de afiliados — abre browser para login ML
npm run test:coupons  # cupons do painel — abre browser para login ML
npm run test:telegram # envia mensagem+foto de teste no canal @e_foxofertas
npm run test:ai       # testa chamadas à API Claude

# --- Jobs de scraping (salva no banco, NÃO posta no Telegram) ---
npm run job:scrape    # roda ofertas + hub em sequência (scrape completo manual)
npm run job:offers    # scrape apenas /ofertas públicas
npm run job:hub       # scrape apenas /afiliados/hub

# --- Jobs de posting (lê do banco e posta no Telegram) ---
npm run job:post      # posta as 5 melhores ofertas pendentes agora
npm run job:repost    # repost de ofertas já postadas (máx 2x/dia)
```

## Deploy

### Situação atual — Rodando local ✅
O bot roda na máquina do desenvolvedor. `npm run start` (ou `npm run dev`) sobe o Express + scheduler no mesmo processo. O scheduler dispara os crons automaticamente.

Para manter o processo vivo sem travar o terminal:
```bash
npm install -g pm2
cd packages/backend
npm run build
pm2 start "npm run start" --name ml-afiliados
pm2 save  # persiste entre reinicializações do PC
```

**Limitação:** se o computador desligar ou perder internet, os jobs param.

### Por que não está em servidor ainda — Problema do Playwright
O scraper do hub e dos cupons usa Playwright com `headless: false` no **primeiro login** para o usuário interagir manualmente (email → WhatsApp code → QR). Servidores remotos (Railway, VPS) não têm interface gráfica, então esse fluxo não funciona remotamente.

Após o primeiro login, a sessão é salva em `.ml-session.json` na raiz do projeto e reutilizada em modo headless indefinidamente. Sessões do ML duram semanas.

### Deploy futuro — Opção A (recomendada): sessão local → env var no servidor

**Passo a passo quando quiser migrar para Railway:**

1. **Gerar sessão localmente** (já está feita se você usou `test:hub` ou `job:hub`):
   ```bash
   cat .ml-session.json
   ```

2. **Converter o JSON para variável de ambiente:**
   Cole o conteúdo inteiro na env `ML_SESSION_JSON` no Railway.

3. **Modificar `auth.ts`** para ler a sessão da env quando disponível:
   ```typescript
   if (process.env.ML_SESSION_JSON) {
     const session = JSON.parse(process.env.ML_SESSION_JSON)
     fs.writeFileSync(SESSION_PATH, JSON.stringify(session))
   }
   ```

4. **Dockerfile para Railway** (Playwright precisa do Chromium):
   ```dockerfile
   FROM node:20-slim
   RUN apt-get update && apt-get install -y \
     chromium fonts-noto-color-emoji \
     --no-install-recommends && rm -rf /var/lib/apt/lists/*
   ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
   WORKDIR /app
   COPY . .
   RUN npm install
   RUN cd packages/backend && npx prisma generate && npm run build
   EXPOSE 3001
   CMD ["sh", "-c", "cd packages/backend && npx prisma migrate deploy && npm run start"]
   ```

5. **Envs a configurar no Railway:**
   ```
   ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID,
   ML_AFFILIATE_ID, ML_AFFILIATE_WORD, ML_EMAIL, ML_PASSWORD,
   ML_HUB_MAX_PRODUCTS, ML_POST_MAX,
   ML_SESSION_JSON   ← conteúdo do .ml-session.json
   ```

6. **Quando a sessão expirar** (semanas depois): gera nova sessão localmente com `npm run test:hub`, copia o novo `.ml-session.json` e atualiza a env `ML_SESSION_JSON` no Railway.

7. **Vercel (frontend):** Root Directory = `packages/frontend`, env `NEXT_PUBLIC_API_URL=https://seu-projeto.up.railway.app`

---

## Próximos passos
- [x] Configurar bot no @BotFather e criar canal público no Telegram — canal: `@e_foxofertas`
- [x] Preencher TELEGRAM_BOT_TOKEN e TELEGRAM_CHANNEL_ID no .env
- [x] Testar envio de mensagem e foto no Telegram — ambos funcionando ✅
- [x] Preencher ANTHROPIC_API_KEY no .env — $5 de crédito, modelo `claude-haiku-4-5`
- [x] Scraper público ML testado — 48 ofertas coletadas ✅
- [x] Login ML funcionando via WhatsApp code + QR code ✅
- [x] Hub scraper: virtual scrolling + coleta incremental — 59 produtos coletados ✅
- [x] Preços do hub corrigidos via `parseBRL()` com regex
- [x] `@anthropic-ai/sdk` atualizado para 0.105.0 (corrige `ERR_STREAM_PREMATURE_CLOSE`)
- [x] IA corrigida: `stripMarkdown()` antes do `JSON.parse` (Haiku retorna JSON em code blocks)
- [x] Todos os produtos scrapados salvos no banco independente de filtros
- [x] Scraping separado do posting — `processOffer` só salva, `runPostingJob` só posta
- [x] Schedule: scrape 1x/dia (6h ofertas, 7h hub), posting a cada 20min (máx 3 por vez)
- [x] Seletores do scraper de cupons corrigidos com HTML real confirmado
- [x] Scraper de cupons refatorado: usa mesma página carregada para clicar "Ver produtos" (evita renavegação)
- [x] `test:hub` cobre hub + cupons em sequência
- [x] Produtos de cupom bypassam filtro de desconto mínimo (desconto é o próprio cupom)
- [x] Logs detalhados: cada etapa do pipeline loga motivo de filtro, score IA, resultado
- [x] `runHubJob` imprime resumo final (total banco, hub/cupom, prontos para post)
- [x] Funções de IA exclusivas para cupons: `evaluateCouponOffer` + `generateCouponPostMessage`
- [x] `ML_HUB_MAX_PRODUCTS` como variável de ambiente para controlar quantidade de scraping do hub
- [x] `minValue` do cupom extraído do **modal de condições** (não da URL) via regex `igual ou superior a R$ X` ✅
- [x] `CouponContext.canApplyAlone` — distingue produto acima/abaixo do mínimo do carrinho ✅
- [x] `effectivePrice` corrigido — produto abaixo do mínimo mantém preço original (não subtrai cupom) ✅
- [x] IA não penaliza `minValue` — produtos abaixo do mínimo são incentivados como âncoras de carrinho ✅
- [x] Copy do cupom adaptado por `canApplyAlone` (preço final vs instrução de carrinho)
- [x] Testar pipeline completo: `npm run job:scrape` → `npm run job:post` — 5 posts enviados com sucesso ✅
- [x] Cadastrar canal `@e_foxofertas` no painel ML Afiliados ✅
- [x] Limpeza de código morto: removidos stubs `RawCoupon`, `scrapeCoupons()` e `export shouldRepost`
- [x] Bug corrigido: `runRepostJob` reconstrói `CouponContext` do banco ao repostar cupons
- [x] **Frontend redesenhado — estilo pelando.com.br** ✅
  - Feed vertical com cards horizontais (voto | imagem | info | CTA)
  - Tabs de ordenação: Novos / Quentes / Descontos / IA Score
  - `VoteButton` com localStorage, temperatura em graus, feedback visual de cor
  - Paginação numérica com reticências inteligente
  - `globals.css` com reset e hide de CTA em mobile
  - Página de detalhe atualizada com VoteButton
- [x] **Campo `upvotes` adicionado** — migration `20260622_add_upvotes` aplicada ✅
- [x] **Endpoints de voto** — `POST /api/offers/:id/vote` e `POST /api/offers/:id/downvote` ✅
- [x] **Classificação automática de categorias** — `classifyCategory()` em `utils/category.ts`, chamada no `processOffer` com backfill automático ✅
- [x] **Backfill histórico executado** — 174 ofertas classificadas; `geral` = fallback para títulos sem keyword conhecida ✅
- [x] Nav do header corrigida para slugs sem acento (`eletronicos`, `esporte`, `moda`, `casa`, `beleza`) ✅
- [x] **Telegram FAB** — botão flutuante fixo no canto inferior direito com SVG oficial do Telegram, hover via CSS ✅
- [x] **WelcomeModal** — aparece na primeira visita, fecha em 5s, barra de progresso animada, link para canal ✅
- [x] **Fonte Nunito** — `next/font/google`, pesos 400-900, self-hosted, sem layout shift ✅
- [x] **Logo centralizado no mobile** — `justify-content: center` + `width: 100%` no `.header-logo` via media query ✅
- [x] **Favicon** — `app/icon.png` (32×32) e `app/apple-icon.png` (180×180), gerados via System.Drawing do .NET a partir do logo ✅
- [x] **"Ver oferta →" redireciona para página interna** — `/oferta/:id` em vez de link de afiliado direto ✅
- [x] **Hover nos botões CTA** — `.btn-cta` com `#e6c800` no hover + `translateY(-1px)` ✅
- [x] **CouponCopy** — badge e box clicáveis copiam o código para clipboard; fallback `execCommand`; feedback visual "✓ Copiado!" ✅
- [x] **Bug de votos corrigido** — `cache: 'no-store'` em `lib/api.ts`; antes `revalidate: 300` causava contador zerado após F5 ✅
- [ ] **Proteção de votos server-side** — implementar junto com autenticação (rate limit por IP ou tabela `Vote` com constraint única)
- [ ] **Endpoint `POST /api/offers/import`** — recebe URL de produto do ML + cupom opcional, scrapa o produto, salva no banco e dispara pipeline de IA para gerar copy e postar no Telegram
- [ ] Autenticação de usuários (NextAuth ou similar) — pré-requisito para comentários e ofertas de usuário
- [ ] Sistema de comentários por oferta
- [ ] Usuários cadastrar ofertas (com aprovação moderada antes de publicar)
- [ ] Deploy Railway + Vercel — ver seção "Deploy" acima com Opção A (sessão via env var)
- [ ] Migrar banco para nuvem (ver opções abaixo) para frontend no Vercel funcionar independente do backend local
- [ ] Adicionar segundo provider (Amazon Afiliados)
- [ ] Remover `Filters.tsx` (legado, não utilizado desde o redesign do feed)
- [ ] SEO: `sitemap.xml` e `robots.txt` dinâmicos — Next.js App Router tem suporte nativo via `app/sitemap.ts`
- [ ] SEO: `og:image` por oferta na página de detalhe (`/oferta/[id]`) para compartilhamento no WhatsApp/redes
- [ ] Analytics: Google Analytics 4 ou Plausible — medir cliques nos links de afiliado (conversão)

### Opções de banco em nuvem

**Opção 1 — PostgreSQL no Railway (recomendada se for fazer deploy lá de qualquer forma)**
- Cria um serviço PostgreSQL no Railway, ele gera uma `DATABASE_URL`
- Muda `schema.prisma`: `provider = "postgresql"`
- Instala driver: `npm install pg`
- Sobe `DATABASE_URL` nas envs locais e no Railway
- Free tier: $5 de crédito grátis, depois cobra por uso

**Opção 2 — Turso (SQLite na nuvem, menor mudança no código)**
- SQLite-compatível, usa driver `libSQL` via `@prisma/adapter-turso`
- Instala: `npm install @libsql/client @prisma/adapter-turso`
- Muda `schema.prisma`: `provider = "sqlite"` → `url = env("TURSO_DATABASE_URL")`
- Frontend no Vercel pode ler o banco diretamente nos server components (sem precisar do Express)
- Free tier generoso: 500MB, 1 bilhão de reads/mês
