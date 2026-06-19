# ML Afiliados Bot — Contexto do Projeto

## O que é
Bot automatizado de ofertas para afiliados do Mercado Livre. Scrapa ofertas públicas do ML, avalia com IA (Claude), gera copy chamativo e posta em canal público do Telegram. Site Next.js exibe as ofertas e serve como plataforma cadastrada no programa de afiliados.

## Stack
- **Monorepo** npm workspaces
- **Backend**: Node.js + TypeScript + Express + Prisma + SQLite + node-cron + Playwright
- **Frontend**: Next.js 15 (App Router)
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
│   │       │   ├── base.provider.ts              # interface AffiliateProvider
│   │       │   └── mercadolivre/
│   │       │       ├── index.ts                  # scraper público /ofertas
│   │       │       ├── auth.ts                   # login ML + sessão salva
│   │       │       ├── scraper-hub.ts            # scraper /afiliados/hub
│   │       │       └── scraper-coupons.ts        # scraper /afiliados/coupons
│   │       ├── jobs/
│   │       │   ├── offers.job.ts                 # pipeline: scrape, IA, posting
│   │       │   └── scheduler.ts                  # cron jobs agendados
│   │       ├── ai/index.ts                       # evaluateOffer + analyzeMarketValue + generatePostMessage
│   │       ├── channels/telegram/index.ts        # sendMessage + sendPhoto
│   │       ├── api/routes/
│   │       │   ├── offers.ts                     # GET /api/offers
│   │       │   └── posts.ts                      # GET /api/posts
│   │       ├── utils/prisma.ts                   # singleton PrismaClient
│   │       └── index.ts                          # Express entry point (porta 3001)
│   └── frontend/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   └── page.tsx                      # grid de ofertas (SSR)
│           ├── components/OfferCard.tsx
│           └── lib/api.ts                        # fetch do backend
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
  createdAt          DateTime @default(now())
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
6h diário   → job:offers  — scrape /ofertas públicas (48 produtos) → salva no banco
7h diário   → job:hub     — scrape /afiliados/hub (até 50 produtos, "Mais vendidos") → salva no banco
a cada 20min → job:post   — posta até 3 ofertas pendentes no Telegram
12h e 20h   → job:repost  — repost de ofertas antigas (máx 2x/dia por oferta)
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
- [x] Schedule: scrape 1x/dia (6h ofertas, 7h hub), posting a cada 2h (máx 2 por vez)
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
- [x] Copy do cupom adaptado por `canApplyAlone`:
  - Produto acima do mínimo → "Você paga: R$X" (preço final com cupom)
  - Produto abaixo do mínimo → "Adicione ao carrinho com outros itens (mín. R$X)"
- [x] Testar pipeline completo: `npm run job:scrape` → `npm run job:post` — 5 posts enviados com sucesso ✅
- [x] Cadastrar canal `@e_foxofertas` no painel ML Afiliados ✅ — em mercadolivre.com.br/afiliados, seção Plataformas/Canais
- [ ] Deploy Railway (backend) + Vercel (frontend)
- [ ] Melhorar frontend (filtros por categoria, busca)
- [ ] Adicionar segundo provider (Amazon Afiliados)
