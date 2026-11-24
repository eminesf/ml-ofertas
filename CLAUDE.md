# ML Afiliados Bot — Contexto do Projeto

> **Marca: Fox Promoções** (desde 22/11/2026; antes "Fox Ofertas", trocado porque já existe a loja foxofertas.com com reclamações). Domínio **`www.foxpromocoes.com.br`** ativo desde 22/11/2026 (Registro.br, DNS modo avançado com os valores recomendados pela Vercel para o projeto: A `@`→216.198.79.1, CNAME `www`→c8d5f285d73e2385.vercel-dns-017.com; sem www redireciona 308. O Registro.br não aceita trocar um CNAME no mesmo salvamento: remover, salvar, adicionar, salvar). `NEXT_PUBLIC_SITE_URL` na Vercel e `SITE_URL` no `.env` apontam para ele — links curtos /r/ novos saem no domínio; os antigos `foxpromocoes.vercel.app/r/…` continuam funcionando. IndexNow (`utils/indexnow.ts`, chave `INDEXNOW_KEY` = `public/<chave>.txt`) avisa Bing/Yandex a cada oferta publicada. Google Search Console: propriedade de domínio verificada por TXT `google-site-verification=…` na zona do Registro.br (não apagar), sitemap enviado em 22/11/2026 (507 URLs). Nome central em `packages/frontend/src/lib/site.ts`. Logo original em `logo_png.png` foi editado (faixa "PROMOÇÕES"). Foco principal: grupo do WhatsApp.

## O que é
Bot automatizado de ofertas para afiliados **multi-plataforma**: Mercado Livre, Amazon, Shopee e Awin (KaBuM!, AliExpress, Stanley). Scrapa/importa ofertas, avalia com IA, gera copy chamativo e posta em canal público do Telegram. Site Next.js exibe as ofertas como feed estilo pelando.com.br e serve como plataforma cadastrada nos programas de afiliados.

## Stack
- **Monorepo** npm workspaces
- **Backend**: Node.js + TypeScript + Express + Prisma + node-cron + Playwright
- **Frontend**: Next.js 15 (App Router) — SSR + client components para interatividade
- **IA**: OpenRouter (`deepseek/deepseek-chat`) via fetch direto (formato OpenAI-compatible) — migrado da Claude API por custo; `OPENROUTER_MODEL` env var permite trocar de modelo sem código
- **Canal**: Telegram Bot API (REST)
- **Banco atual**: PostgreSQL 16 em Docker no PC (`docker-compose.yml`, porta `5433`) — `DATABASE_URL=postgresql://mlofertas:mlofertas@localhost:5433/mlofertas`
- **Hospedagem atual (desde 2026-10-31)**: o backend roda 24h no PC via pm2 (`ecosystem.config.js`: só `ml-ofertas-backend`; o frontend local :3002 foi desligado em 23/11/2026 — o site público é só a Vercel). Railway **desativado** (não pago) — URL antiga comentada no `.env`; Vercel (`foxpromocoes.vercel.app`) usa a API do PC via Cloudflare Tunnel: `NEXT_PUBLIC_API_URL=https://api-ofertas.emiliano.dev.br`
- `dev.db` (SQLite) é legado de junho/2026 — não é mais usado

## Estrutura de pastas
```
ml-afiliados/
├── packages/
│   ├── backend/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── providers/
│   │       │   ├── base.provider.ts              # interface AffiliateProvider (name, scrapeOffers, buildAffiliateLink)
│   │       │   ├── registry.ts                   # resolve provider + externalId a partir de qualquer URL suportada
│   │       │   ├── html-product.ts               # scraper genérico JSON-LD + og:meta (fetch → fallback Playwright)
│   │       │   ├── mercadolivre/
│   │       │   │   ├── index.ts                  # scraper público /ofertas
│   │       │   │   ├── auth.ts                   # login ML + sessão salva
│   │       │   │   ├── scraper-hub.ts            # scraper /afiliados/hub
│   │       │   │   ├── scraper-coupons.ts        # scraper /afiliados/coupons
│   │       │   │   └── scraper-product.ts        # scraper de produto único por URL (usado pelo /import)
│   │       │   ├── amazon/
│   │       │   │   ├── index.ts                  # AmazonProvider: tag de associado + scraper /deals
│   │       │   │   └── scraper-product.ts        # produto único por ASIN (fetch HTTP + fallback genérico)
│   │       │   ├── awin/index.ts                 # AwinProvider (Kabum/AliExpress/Stanley) + deeplink cread.php + feedIds
│   │       │   ├── awin/feed.ts                  # scrape de listagem via product feed Awin (CSV gzip) + queda de preço (FeedPrice)
│   │       │   ├── shopee/index.ts               # ShopeeProvider — link an_redir com SHOPEE_AFFILIATE_ID (sem Open API)
│   │       │   └── shopee/feed.ts                # feed de produto diário do portal (CSV, 10k produtos/arquivo)
│   │       ├── jobs/
│   │       │   ├── offers.job.ts                 # pipeline: scrape, IA, posting, repost
│   │       │   ├── scrape-cli.ts                 # CLI de scraping 100% LOCAL (ml|hub|amazon|all)
│   │       │   └── scheduler.ts                  # cron jobs agendados (SÓ posting/repost — sem scraping)
│   │       ├── ai/index.ts                       # evaluateOffer + analyzeMarketValue + generatePostMessage
│   │       ├── channels/telegram/index.ts        # sendMessage + sendPhoto
│   │       ├── api/routes/
│   │       │   ├── offers.ts                     # GET /api/offers + POST /vote + POST /downvote + POST /import
│   │       │   ├── posts.ts                      # GET /api/posts
│   │       │   └── admin.ts                      # POST /api/admin/job/* — disparo manual de jobs (Bearer ADMIN_SECRET)
│   │       ├── utils/prisma.ts                   # singleton PrismaClient
│   │       └── index.ts                          # Express entry point (porta 3001)
│   └── frontend/
│       └── src/
│           ├── app/
│           │   ├── globals.css                   # reset box-sizing + hide CTA em mobile (<520px)
│           │   ├── layout.tsx                    # header amarelo, footer, importa globals.css
│           │   ├── sitemap.ts                    # sitemap.xml dinâmico (home + categorias + 500 ofertas)
│           │   ├── page.tsx                      # feed lista com tabs de ordenação (SSR)
│           │   ├── oferta/[id]/page.tsx          # página de detalhe + generateMetadata (og:image) (SSR)
│           │   ├── categoria/[slug]/page.tsx     # feed filtrado por categoria (SSR)
│           │   ├── admin/login/page.tsx          # página de login admin ('use client') — redireciona para /admin após auth
│           │   ├── admin/layout.tsx              # layout admin: header escuro + nav + botão logout ('use client')
│           │   ├── admin/page.tsx                # dashboard com botões de disparo de jobs ('use client')
│           │   └── admin/import/page.tsx         # formulário de import manual ('use client') — protegido pelo middleware
│           ├── components/
│           │   ├── OfferCard.tsx                 # card horizontal estilo pelando (server component)
│           │   ├── VoteButton.tsx                # botão de upvote com localStorage ('use client')
│           │   ├── CouponCopy.tsx                # badge/box de cupom com copy para clipboard ('use client')
│           │   ├── BackButton.tsx                # botão "← Voltar" que usa history.back() ('use client')
│           │   ├── WelcomeModal.tsx              # modal primeira visita + link Telegram ('use client')
│           │   └── Filters.tsx                   # (legado — não usado; pode remover)
│           ├── lib/api.ts                        # fetch do backend + tipos Offer/Post + voteOffer()
│           └── middleware.ts                     # protege /admin/* — redireciona para /admin/login sem cookie admin_token
├── .env
├── Dockerfile                                    # build Railway — node:20-slim + Playwright Chromium
├── .dockerignore
├── railway.toml                                  # dockerfilePath + healthcheck /api/offers
├── packages/.ml-session.json                    # sessão ML salva pelo auth (gerado em runtime)
└── package.json                                  # concurrently dev
```

## Variáveis de ambiente (.env)
```env
OPENROUTER_API_KEY=           # configurado ✅ — IA via OpenRouter (deepseek-chat)
OPENROUTER_MODEL=             # opcional — default deepseek/deepseek-chat
ANTHROPIC_API_KEY=            # legado — não é mais usada (IA migrou para OpenRouter)
TELEGRAM_BOT_TOKEN=           # configurado ✅ — bot criado via @BotFather
TELEGRAM_CHANNEL_ID=@e_foxofertas  # canal público criado e testado ✅
AMAZON_ASSOCIATE_TAG=foxofertas04-20  # tag do Amazon Associados (default no código)
AWIN_AFFILIATE_ID=2953175     # publisher ID Awin (default no código)
ML_AFFILIATE_ID=28042140      # matt_tool do ML Afiliados
ML_AFFILIATE_WORD=fuchsecommerce   # matt_word / prefixo do afiliado
ML_EMAIL=                     # login ML para hub/cupons
ML_PASSWORD=                  # senha ML para hub/cupons (opcional — ML pode logar por WhatsApp/QR)
ML_HUB_MAX_PRODUCTS=50        # máximo de produtos a coletar do hub (padrão 50, pode reduzir para testes)
ML_POST_MAX=3                 # máximo de posts por rodada do cron (a cada 20min, padrão 3)
ADMIN_SECRET=                 # segredo para endpoints /api/admin/* — header Authorization: Bearer <valor>
NODE_ENV=development
PORT=3001
DATABASE_URL=                 # local: postgresql://... (Railway public URL) | prod: referência interna Railway
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Variáveis exclusivas do Railway (não ficam no .env local)
```env
ML_SESSION_JSON=              # conteúdo minificado do packages/.ml-session.json
                              # gerar com: node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('packages/.ml-session.json','utf8'))))"
                              # quando a sessão expirar: gerar nova com job:hub local, minificar e atualizar no Railway
DATABASE_URL=${{Postgres.DATABASE_URL}}   # referência interna Railway (privada, mais rápida)
```

## Banco de dados (PostgreSQL em produção, SQLite local)

**Produção (Railway):** PostgreSQL, provider `postgresql`, `DATABASE_URL` via env Railway.
**Local (dev):** SQLite, arquivo `packages/backend/prisma/dev.db` — não existe migration SQLite mais, banco local só para testes sem Railway.

**Migrar dados locais para o Railway:**
```bash
# dentro de packages/backend
DATABASE_URL="postgresql://..." npx tsx src/migrate-to-pg.ts
# lê dev.db via better-sqlite3, faz upsert em cada tabela no PG — seguro rodar mais de uma vez
```

**Ver conteúdo do banco no Railway:** aba Console do serviço Postgres:
```bash
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "Offer";'
```

**Prisma Studio apontando para Railway (local):**
```bash
DATABASE_URL="postgresql://PUBLIC_URL" npx prisma studio
```

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

## Produtos hype e limpeza do banco
- `utils/hype.ts` → `isHype(title)`: console (PS5, Switch 2, Xbox), GTA 6, DualSense, peça de PC (placa de vídeo, processador, SSD NVMe, DDR5, placa-mãe). Notebook/PC montado e capinha "para PS5" ficam de fora. Hype aceita desconto ≥ 8% (normal 20%), ganha +3 na fila (`postPriority`), não perde ponto na IA pelo preço alto e vem primeiro no feed KaBuM.
- `npm run scrape:hype` → busca na Amazon por `HYPE_SEARCH_TERMS` (preço "De:" riscado = desconto); roda junto com ML/Amazon às 9h30/15h30.
- `jobs/cleanup.job.ts` (4h10): apaga oferta nunca postada > 30 dias (`CLEANUP_UNPOSTED_DAYS`), postada com último post > 90 dias (`CLEANUP_POSTED_DAYS`, com os posts) e `FeedPrice` parado > 90 dias. A página some e vira o 404 próprio (`app/not-found.tsx`, mostra ofertas quentes, noindex).

## Instagram (@fox_promocoes_) — stories manuais
- `/story/<id>` gera a arte 1080x1920 (next/og, fonte Nunito via Google Fonts TTF; imagem webp do ML trocada por jpg); `?d=1` baixa. Rodapé livre para a figurinha de link.
- `/admin/stories`: as 8 melhores ofertas das últimas 24h (nota IA + desconto + votos) com botão "Baixar arte" e link curto. Postagem é manual (1–2 por dia).

## Convite para o site
- `jobs/site-invite.job.ts`: 1x/dia (`SITE_INVITE_CRON`, padrão `50 12 * * *`) manda nos dois canais um convite para o site com a imagem de compartilhamento (`/opengraph-image`) e o nº de ofertas das últimas 24h; 4 textos que se revezam por dia.

## Envio imediato, fila no admin e boas-vindas
- Fontes do Telegram são lidas a cada 5 min (`TELEGRAM_SOURCE_CRON`), com trava própria (não esperam o scrape ML/Amazon/hub). Oferta aprovada vinda delas é postada NA HORA: o processo filho chama `POST /api/admin/offer/:id/send` do backend (que tem o socket do WhatsApp). Máx `TELEGRAM_INSTANT_MAX` (3) por rodada; o resto vai para a fila com +6 e vale `TELEGRAM_SOURCE_MAX_AGE_HOURS` (3h). Motivo: em 23/11/2026 um box Pokémon postado às 15h29 na fonte saiu 18h20 aqui (cupom já tinha acabado).
- `publishOffer` tem trava contra post duplo (Set em memória + checa `Post`), porque o envio imediato e o posting de 20 em 20 min podem pegar a mesma oferta.
- `/admin/fila`: ofertas aprovadas sem post (6–72h), na ordem de `postPriority`, com botão **Enviar** (proxy `/api/admin/send/[id]`, fila via `/api/admin/queue`).
- `jobs/welcome.job.ts`: quem entra no grupo do WhatsApp (`group-participants.update`) recebe, NO GRUPO e com @menção, as ofertas que já saíram hoje + link do site. Agrupa entradas (3 min) e no máx 1 a cada `WHATSAPP_WELCOME_COOLDOWN_MIN` (60); de madrugada espera o horário. DM para cada membro foi descartado (risco de ban). `WHATSAPP_WELCOME_DISABLED=true` desliga.

## Madrugada e Pokémon
- Grupos PRIVADOS do Telegram (`TELEGRAM_PRIVATE_SOURCES=+HASH,...`, ex.: "Promoções Pokémon") são lidos pela conta do dono via MTProto (`telegram`/gram.js, `channels/telegram/user-client.ts`): só leitura. Credenciais `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` (my.telegram.org) e sessão em `packages/.telegram-user-session` (gitignored) criada com `npm run telegram:login` (o dono digita telefone e código). Mesmo pipeline dos canais públicos (`handleSourcePost`).
- Fora de `POST_HOURS` (8–23h) o posting só libera ofertas com source `telegram` (o que os canais garimpados postam de madrugada, a gente posta também). Os canais são lidos 24h.
- Categoria `pokemon` (aba "Pokémon TCG" no site) é a PRIMEIRA regra de `classifyCategory` (pokémon, pikachu, charizard, eevee, elite trainer box).

## Classificação automática de categorias

O ML não expõe categoria por produto no listing. A classificação é feita por palavras-chave no título, em `src/utils/category.ts`, função `classifyCategory(title: string): string`.

### Categorias disponíveis
| Slug | Label no frontend |
|---|---|
| `pokemon` | Pokémon TCG |
| `eletronicos` | Eletrônicos |
| `esporte` | Esporte e Suplementos |
| `moda` | Moda e Acessórios |
| `casa` | Casa e Eletrodomésticos |
| `beleza` | Beleza e Cuidados |
| `automotivo` | Automotivo |
| `ferramentas` | Ferramentas |
| `geral` | fallback — nenhum keyword bateu |

### Livros ficam de fora
`isBook(title, externalId)` em `utils/category.ts` (ASIN da Amazon só com dígitos = ISBN, ou título com livro/capa comum/edição de luxo…) — `processOffer` descarta antes de salvar. 28 livros removidos em 22/11/2026 (backup em `packages/livros-removidos-20261122.json`).

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

Resposta: `{ offers, total, page, limit }` — cada oferta inclui `upvotes` e `couponMinValue` (join com tabela `Coupon` via `couponCode`; `null` se não há cupom ou cupom sem valor mínimo).

### POST /api/offers/:id/vote
Incrementa `upvotes` em 1. Resposta: `{ upvotes: number }`

### POST /api/offers/:id/downvote
Decrementa `upvotes` em 1 (pode ir negativo). Resposta: `{ upvotes: number }`

### GET /api/offers/:id
Retorna oferta completa com todos os posts e `couponMinValue` (join com `Coupon`).

### GET /api/posts
Lista posts do Telegram.

### POST /api/offers/import ✅
Importa produto manualmente por URL do ML, roda pipeline de IA e posta imediatamente no Telegram.

**Body (JSON):**
```json
{
  "url": "https://www.mercadolivre.com.br/p/MLB64311324",
  "couponCode": "#FUCHS20OFF",
  "couponMinValue": 120
}
```
- `url` — obrigatório. Aceita qualquer formato de URL do ML, incluindo URLs com fragmento `#` (links de busca). O scraper normaliza para a URL canônica antes de salvar.
- `couponCode` e `couponMinValue` — opcionais, mas **devem ser enviados juntos** (ambos ou nenhum). `couponDiscount` não é necessário — o pipeline usa `generatePostMessage` com o código como parâmetro extra.

**Fluxo real implementado:**
1. Valida campos; retorna `422` se só um campo do par cupom/valor-mínimo foi enviado
2. Extrai `externalId` via regex `MLB-?(\d+)` → `MLB{digits}`; retorna `400` se não encontrado
3. Retorna `409` se `externalId` já existe no banco
4. `scrapeProductByUrl(url)` — Playwright headless, `networkidle`, wait em seletor antes de extrair
5. Se `couponCode` + `couponMinValue`: upsert na tabela `Coupon` (para o frontend mostrar o valor mínimo)
6. `processOffer(raw, mlProvider, couponCode, source='manual'|'coupon')` — `source='manual'` bypassa filtro de desconto mínimo; sem `CouponContext` (sem `couponDiscount`) usa avaliação e copy normais mas mencionando o código
7. Posta no Telegram se a IA aprovou (`offer.telegramMessage != null`)
8. Retorna `{ offer, posted: boolean }`

**`scrapeProductByUrl` — detalhes técnicos (`scraper-product.ts`):**
- Separa fragmento `#` antes de navegar: `url.split('#')[0]` → evita fragmentos de rastreamento do ML
- `wid` detectado com `[?&#]wid=(MLB\d+)` — cobre `wid` em query string E em fragmento `#`
- `waitUntil: 'networkidle'` + `waitForSelector('h1, .andes-money-amount__fraction')` antes de extrair
- JSON-LD como fonte primária (`@type: "Product"`, campo `price` ou `lowPrice`)
- Múltiplos seletores CSS em fallback para preço, imagem, desconto e avaliação

**Erros:**
- `400` — URL inválida (sem ID MLB) ou scraping falhou (sem título/preço)
- `409` — oferta já existe (retorna a oferta existente)
- `422` — `couponCode` e `couponMinValue` enviados separados

### Autenticação do painel admin ✅

Todas as rotas `/admin/*` (exceto `/admin/login`) são protegidas por `src/middleware.ts` no Next.js frontend.

**Fluxo:**
1. Usuário acessa qualquer rota `/admin/*` sem cookie → redirecionado para `/admin/login?from=<rota>`
2. Login: digita senha → `POST /api/admin/login` (Next.js API route) → compara com `ADMIN_SECRET` (env var server-only) → define cookie httpOnly `admin_token` com validade de 7 dias
3. Middleware verifica `admin_token` — se presente, passa; se ausente, redireciona
4. Logout: botão no header → `POST /api/admin/logout` → deleta cookie → redireciona para `/admin/login`

**Variável necessária:** `ADMIN_SECRET` — configurar no Vercel (env var server-only, sem `NEXT_PUBLIC_`). O mesmo valor deve estar no Railway para os endpoints backend.

**Proxy de jobs (segurança):** O browser chama `POST /api/admin/job/{job}` (Next.js API route). Essa rota lê o cookie httpOnly server-side, valida contra `ADMIN_SECRET`, e repassa para o backend com `Authorization: Bearer`. O secret nunca vai para o bundle do browser.

**`ADMIN_SECRET` no Railway:** além do Vercel, precisa estar configurado no Railway para os endpoints backend `/api/admin/job/*` funcionarem.

### Endpoints admin — disparo manual de jobs ✅

Todos protegidos por `Authorization: Bearer ADMIN_SECRET`. Retornam imediatamente com `{ started: true, job: "..." }` — o job roda em background (fire-and-forget); acompanhe pelo log do servidor.

| Método | Rota | Job disparado |
|--------|------|--------------|
| `POST` | `/api/admin/job/post` | `runPostingJob` — posta pendentes; `?max=N` sobrescreve ML_POST_MAX |
| `POST` | `/api/admin/job/repost` | `runRepostJob` — repost de ofertas válidas |

> Os endpoints `job/offers` e `job/hub` foram **removidos** — scraping é 100% local (`npm run scrape`), não roda mais no Railway.

> **⚠️ Comportamento do repost:** só reposta ofertas que **já foram postadas hoje**. Se nenhuma oferta foi postada no dia, o job não faz nada. Para publicar ofertas novas, use `job/post`. Fluxo correto: `npm run scrape` (local) → `job/post` → (nas 12h/20h) `job/repost`.

**Exemplo de chamada:**
```bash
curl -X POST https://aware-recreation-production-0d45.up.railway.app/api/admin/job/post \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"
```

**Segurança:**
- Sem `ADMIN_SECRET` configurado no servidor → `503`
- Header incorreto ou ausente → `401`
- Jobs de hub/repost dependem de sessão ML válida (`ML_SESSION_JSON`)

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
- `-X% OFF` (vermelho) — quando `discountPct > 0`
- `⚡ Oferta especial!` (roxo `#7c3aed`) — quando `discountPct === 0` (produto sem preço anterior)
- `🎟️ Cupom` / `🎟️ mín. R$X` (âmbar) — `<CouponCopy variant="badge" />`, clicável: copia código; exibe valor mínimo no rótulo quando `couponMinValue` presente
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
- `variant="badge"` — badge compacto; rótulo: `🎟️ mín. R$X` se `minValue` presente, senão `🎟️ Cupom`; clique copia e exibe "✓ Copiado!" por 2s
- `variant="box"` — bloco de cupom na página de detalhe; código clicável; exibe linha `⚠️ Válido para compras acima de R$X,XX no carrinho` quando `minValue` presente
- Props: `code`, `variant`, `amount?`, `minValue?: number | null`
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
- `<BackButton />` — usa `history.back()` quando `document.referrer` é do mesmo domínio; fallback `href="/"` para acesso direto (preserva página do feed ao voltar)
- VoteButton centralizado abaixo da imagem com texto "Essa oferta é boa?"
- Badge de aiScore visível
- `<CouponCopy variant="box" minValue={offer.couponMinValue} />` — código clicável; aviso de valor mínimo quando aplicável
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

## Agendamento (scheduler.ts) — SÓ posting/repost no Railway
```
a cada 20min → posting — POST_MAX (1) oferta, a MESMA no Telegram e no WhatsApp (utils/publish.ts), só em POST_HOURS (8-23), só com imagem e ≤ POST_MAX_AGE_HOURS (72h); fila = nota IA + bônus de ticket baixo + variedade de categoria/loja; ofertas dos canais do Telegram (source `telegram`) têm +6 e só valem por 6h
12h e 20h    → repost  — até REPOST_MAX (3) ofertas postadas HOJE, nos dois canais (máx 2x/dia por oferta, intervalo mín. 4h)
6h15, 12h15 e 18h15 → feeds Awin (Kabum + Stanley), requer AWIN_FEED_API_KEY
7h40 e 21h40 → feed Shopee, requer SHOPEE_FEED_URLS
10/30/50 de toda hora (24h) → canais públicos do Telegram (`TELEGRAM_SOURCES` no `.env`: `wolf_ofertas,pcdofafapromo`) via `jobs/telegram-source.ts`: lê `t.me/s/<canal>`, resolve o link curto até o produto (ML social → polycard com o mesmo título do og:title), descarta o afiliado deles, revalida o preço (pula se a loja estiver >10% acima do post) e passa pelo `processOffer` (source `telegram`, sem filtro de desconto mínimo; IA decide). Último post lido em `.telegram-sources.json`. Posts de cupom e lojas não suportadas (Magalu) são pulados. `Cupom: CODIGO` do post (cupom público da loja) vai como `couponCode` no nosso copy, e a tolerância de preço sobe para 25% quando o post tem cupom/Pix. `npm run scrape:telegram`
10h45 e 16h45 → hub de afiliados ML (até 20 "Mais vendidos" `HUB_BEST_SELLER_MAX` + 10 "Ganhos extras" `HUB_EXTRA_MAX` + cupons #FUCHS) com a sessão do `ml:login`; agendado roda headless e, se a sessão expirou, NÃO abre login: pula e avisa no WhatsApp (máx 1x/12h)
9h30 e 15h30 → scrape ML /ofertas + Amazon /deals (Playwright em processo filho; PULA se o bot-leilao tiver leilão ativo ou agendado nos próximos 90 min — lê C:/dev/bot-leilao/data/leilao.db só leitura via utils/leilao-guard.ts)
```

Início automático no PC: tarefa `ml-ofertas-pm2-resurrect` roda `scripts/start-local.ps1` no login **e a cada 10 min**. Se a API (3001) responde, sai sem fazer nada; senão sobe Docker → Postgres → `pm2 resurrect` + `pm2 start ecosystem.config.js`. Log em `~/.pm2/start-local.log`. (Em 11/11/2026 um reinício do Windows Update + falha da execução no login deixou tudo fora do ar por 8 dias — por isso a repetição.)

**⚠️ Scraping NÃO roda mais no Railway.** Os crons de 6h/7h foram removidos — scraping no Railway pesava o container e sofria CAPTCHA/bloqueios de IP de datacenter, além de bugs de sessão no hub ML. Todo scraping é 100% local e manual via `scrape-cli.ts` (grava direto no Postgres do Railway pela `DATABASE_URL`, então o posting agendado do Railway posta os produtos normalmente). Os endpoints admin `job/offers` e `job/hub` foram removidos pelo mesmo motivo (restam `job/post` e `job/repost`).

## Scraping local (scrape-cli.ts)
```bash
# na raiz do monorepo (ou dentro de packages/backend):
npm run scrape          # todas as plataformas (ml + amazon + hub)
npm run scrape:ml       # só ofertas públicas do ML
npm run scrape:hub      # só hub de afiliados ML + cupons (abre browser p/ login se sessão expirou)
npm run scrape:amazon   # só ofertas do dia da Amazon (/deals)
npm run scrape:awin     # product feeds Awin (Kabum + Stanley) — requer AWIN_FEED_API_KEY
npm run scrape:shopee   # feed de produto da Shopee — requer SHOPEE_FEED_URLS
npm run scrape:show     # tudo, com browser visível (ou `-- --show` em qualquer alvo, dentro de packages/backend)
```
AliExpress não tem scraping de listagem — produtos entram via import por URL no painel admin (`/admin/import`).

### Feed de produto Shopee (`shopee/feed.ts`)
- Portal de afiliados → Criativo → Feed de produto → "Ver Link": 2 feeds ("Shopee Oficial BR", "Shopee Brasil"), CSV atualizado 1x/dia (~20h). O download não pede login — o `id` da URL identifica a conta → URLs só no `.env` (`SHOPEE_FEED_URLS`, separadas por vírgula).
- Parser próprio (`parseFeedCsv`) que recorta campos por índice e guarda só as colunas usadas: o `parseCsv` da Awin estourou a memória com os ~22 MB de descrições.
- Filtro antes da IA: desconto 20–70% (acima disso é quase sempre preço "de" inflado), nota ≥ 4.5, preço ≥ R$10, máx. 2 por loja, ordenado por nota e depois desconto, até `SHOPEE_FEED_MAX` (20).
- O `product short link` do feed vem SEM `affiliate_id` — não usar.

### Product feeds Awin (`awin/feed.ts`)
- Download: `productdata.awin.com/datafeed/download/apikey/{AWIN_FEED_API_KEY}/fid/{ids}/columns/.../format/csv/compression/gzip/` — chave = segmento de 32 hex da URL "Download da Lista de Feed" (Ferramentas → Crie um Feed). CORS bloqueia o download pelo browser; só via Node.
- Pré-filtro antes da IA: em estoque, moeda BRL, desconto ≥ 20%, ordenado por desconto, máx `AWIN_FEED_MAX` (padrão 30) por loja.
- **Stanley** (feed 72033): preço "de" em `base_price` ("220.00 BRL") ✅
- **Kabum** (feed 46967, ~5k produtos): feed **não tem preço "de"** (`custom_3` é o preço parcelado ~5% acima — não usar). `discountSource: 'priceDrop'` → tabela `FeedPrice` guarda último preço; queda ≥ 20% entre scrapes vira oferta com o preço anterior como `originalPrice`. Primeiro scrape só forma a base.
- **AliExpress**: 20 feeds BR & LATAM (47201..47257) vêm em **CNY/USD** e inglês → sem `feedIds` de propósito.
- `externalId` via `awinExternalId(url)` — mesmo formato do import por URL (sem duplicar).

## WhatsApp (grupo via Baileys)
- `channels/whatsapp/index.ts` — `@whiskeysockets/baileys` **7.0.0-rc14**, mesma versão do bot-leilao. Pacote ESM carregado sob demanda: requer Node >= 22.12.
- Parear: botão "Conectar WhatsApp" em `/admin` (`WhatsAppModal.tsx`, consulta `/api/admin/whatsapp/status` a cada 3s, mostra QR e grupos) ou `npm run whatsapp:login` com o backend parado. Sessão em `packages/.wa-session/` (gitignored, contém credenciais).
- Liga com `WHATSAPP_ENABLED=true` + `WHATSAPP_GROUP_JID=<id>@g.us`. Opcionais: `WHATSAPP_POST_MAX` (1 por rodada), `WHATSAPP_HOURS` (`8-22`), `WHATSAPP_MAX_AGE_HOURS` (48).
- `runWhatsAppPostingJob` roda nos minutos 5 e 35. Cada canal controla seus próprios `Post` (`channel`): filtros de Telegram e repost usam `channel: 'telegram'`.

## Providers multi-plataforma

| Provider (`Offer.provider`) | Link de afiliado | Import por URL | Scrape de listagem |
|---|---|---|---|
| `mercadolivre` | `?matt_tool=28042140&matt_word=fuchsecommerce` | ✅ API ML → HTTP → Playwright | ✅ /ofertas + hub |
| `amazon` | `?tag=foxofertas04-20` | ✅ HTTP (productTitle/a-offscreen) → genérico | ✅ /deals (local) |
| `kabum` | Awin deeplink mid=17729 | ✅ JSON-LD via html-product.ts | ✅ feed Awin (queda de preço) |
| `aliexpress` | Awin deeplink mid=18879 | ⚠️ best-effort (JS-heavy, fallback Playwright) | ❌ |
| `stanley` | Awin deeplink mid=30599 | ✅ JSON-LD (Shopify) | ✅ feed Awin |
| `shopee` | `shope.ee/an_redir?origin_link=…&affiliate_id=SHOPEE_AFFILIATE_ID&sub_id=foxofertas` | ⚠️ best-effort (bot-protection forte; usar dados manuais) | ✅ feed de produto diário |

- **Registry** (`providers/registry.ts`): `resolveProviderByUrl(url)` detecta a plataforma pelo hostname e devolve provider + externalId + scraper de produto. Usado pelo `/api/offers/import`.
- **externalId prefixado por plataforma** — sem migration: ML mantém `MLB{digits}` (compatível com banco existente); Amazon `AMZN-{ASIN}`; Kabum `KABUM-{id}`; AliExpress `ALIEXP-{id}`; Stanley `STANLEY-{handle}`; Shopee `SHOPEE-{shopId}-{itemId}`. Prefixos garantem unicidade global sem alterar o schema.
- **Awin deeplink**: `https://www.awin1.com/cread.php?awinmid={MID}&awinaffid=2953175&ued={URL_ENCODED}` — publisher ID 2953175 (PF - Fox Ofertas e Promoções).
- **Shopee sem Open API**: o botão "Aplicar" em affiliate.shopee.com.br/open_api fica desativado ("peça acesso ao gerente da conta"). Não faz falta: o link de afiliado é o redirecionador `shope.ee/an_redir` com `affiliate_id` (campo `affiliate_id` de `/api/v3/user/profile` no portal → `SHOPEE_AFFILIATE_ID`); o redirect leva `utm_source=an_<ID>&utm_medium=affiliates` (testado). O campo "Link de afiliado" do import ficou opcional — se preenchido, sobrescreve o gerado.
- **`processOffer` aceita `affiliateUrlOverride`** (último parâmetro) — usado pelo import para o link curto da Shopee.

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
- **URLs de produto com variação:** a URL bruta do scraper pode conter `?wid=MLB...` quando o produto tem variações (cor, tamanho). Nesse caso, `cleanUrl` monta `https://produto.mercadolivre.com.br/MLB-XXXXXXX` em vez de limpar a query string. Sem `wid` → produto multi-vendedor → `url.split('?')[0]` (mantém `/p/MLB...`)
- **`buildAffiliateLink`** apenas appenda `matt_tool` e `matt_word` à URL recebida, sem normalizar domínio — preserva `produto.mercadolivre.com.br` para variações

### Sessão do ML e captcha (`providers/mercadolivre/browser.ts`)
- Desde ~nov/2026 o ML manda acesso anônimo (página de produto, busca, às vezes /ofertas) para `gz/account-verification` / captcha, e a API pública (`/items`, `/sites/MLB/search`) responde **403** sem token de app.
- Scrape de /ofertas, import de produto e hub usam a MESMA sessão salva (`packages/.ml-session.json`) via `newMlContext()`; cookies são regravados após cada página OK.
- Bloqueio detectado → log + aviso no WhatsApp do dono (máx. 1x/12h, `.ml-blocked-notice`) e o import devolve mensagem pedindo `npm run ml:login`.
- `npm run ml:login`: abre o Chromium **visível**, o dono resolve captcha/login, salva a sessão. Nunca resolver captcha automaticamente.
- Alternativa futura: app de desenvolvedor do ML (OAuth) para a API oficial.

### Scraper hub (/afiliados/hub)
- Requer login autenticado
- Clica no botão `#best_seller` ("Mais vendidos") após carregar, aguarda `networkidle`
- **Virtual scrolling**: ML mantém apenas ~30 cards no DOM por vez, removendo os que saem de vista
- Solução: **coleta incremental** — a cada scroll de 800px extrai os cards visíveis e armazena em `Map` por `externalId` para deduplicar
- Para quando acumula `MAX_PRODUCTS` (50) ou 4 rounds sem cards novos
- Extração de preço via `parseBRL()` — usa `textContent` do elemento e regex, mais robusto que extrair fraction/cents separados
- Filtro de keywords removido — a IA filtra por score

### Auth ML (auth.ts)
- Salva sessão em `packages/.ml-session.json`
- Verifica sessão existente navegando para `/afiliados/hub` — reutiliza se válida
- **`NODE_ENV=production`**: `headless: true` automático (sem GUI no servidor)
- **`ML_SESSION_JSON` env var**: se presente, sobrescreve o arquivo de sessão antes de verificar — mecanismo usado no Railway para injetar sessão sem arquivo físico
- **Primeiro login local: `headless: false`** para interação manual (browser visível)
- Fluxo de login atual do ML: email → verificação por WhatsApp code → QR code → logado (sem etapa de senha)
- Usa `Promise.race` entre `waitForSelector('#password, ...)` e `waitForURL(url_logado)` — suporta login com senha E sem senha
- Timeout de 5 minutos para o usuário completar verificações manualmente
- **Sessão expirada no Railway**: hub/coupon jobs falham silenciosamente; scraper público `/ofertas` continua funcionando (não precisa de auth). Renovar: rodar `job:hub` local, minificar JSON, atualizar env `ML_SESSION_JSON` no Railway

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
- **OpenRouter** com modelo `deepseek/deepseek-chat` (V3) — migrado da Claude API por custo
- Sem SDK: `fetch` direto para `https://openrouter.ai/api/v1/chat/completions` (formato OpenAI-compatible), helper `chat(prompt, maxTokens)` interno
- Env vars: `OPENROUTER_API_KEY` (obrigatória — **precisa estar no Railway também**, o repost gera copy) e `OPENROUTER_MODEL` (opcional, troca de modelo sem código)
- Todas as respostas passam por `stripMarkdown()` antes de `JSON.parse` — LLMs às vezes retornam JSON dentro de ``` ```json ``` ```
- Contexto de tendências injetado em todos os prompts (Copa FIFA 26, Pokémon TCG, inverno BR)
- Testar: `npm run test:ai` (não grava nada, só chama a API)

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
**Nos posts vai o link curto do site**: `https://www.foxpromocoes.com.br/r/{Offer.shortCode}` → rota `app/r/[code]/route.ts` chama `GET /api/offers/go/:code` (conta `Offer.clicks`, exceto robôs de prévia) e redireciona 302 para o `affiliateUrl`. `SITE_URL` no backend troca o domínio. Copies antigos com link cheio são trocados na hora do envio (`withShortLink`).

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
npm run test:ai       # testa OpenRouter/DeepSeek (não grava nada)
npm run test:providers -- <url>          # resolve provider, scrapa produto e mostra link afiliado
npm run test:providers -- --amazon-deals # testa scraper de listagem da Amazon

# --- Scraping local (salva no banco Railway, NÃO posta no Telegram) ---
npm run scrape         # todas as plataformas (ml + amazon + hub)
npm run scrape:ml      # apenas /ofertas públicas ML
npm run scrape:hub     # apenas /afiliados/hub + cupons
npm run scrape:amazon  # apenas ofertas do dia Amazon

# --- Jobs de posting (lê do banco e posta no Telegram) ---
npm run job:post      # posta as 5 melhores ofertas pendentes agora
npm run job:repost    # repost de ofertas já postadas (máx 2x/dia)
```

## Deploy

### Situação atual — Em produção ✅
- **Backend**: Railway — `https://aware-recreation-production-0d45.up.railway.app`
- **Frontend**: Vercel — `https://foxpromocoes.vercel.app`
- **Banco**: PostgreSQL no Railway (serviço `Postgres`)

### Arquitetura de deploy
```
Dockerfile (raiz do monorepo)
  └── node:20-slim
  └── npx playwright install --with-deps chromium   ← Chromium para scrapers
  └── npm ci                                        ← instala workspace inteiro
  └── prisma generate + tsc (só packages/backend)
  └── CMD: prisma migrate deploy → node dist/index.js

railway.toml
  └── dockerfilePath = "Dockerfile"
  └── healthcheckPath = "/api/offers"
```

### Migrations
- Provider: `postgresql` em `schema.prisma`
- Única migration: `20260623000000_pg_init/migration.sql` — baseline PostgreSQL (substitui as duas migrations SQLite que existiam)
- `migration_lock.toml`: provider = "postgresql"
- `prisma migrate deploy` roda automaticamente no CMD do container

### Fixes de build Railway (2026-06-24) — histórico de erros resolvidos

Quatro problemas ocorreram em sequência ao fazer o primeiro deploy em produção:

**1. CAPTCHA no scraper de produto em produção** (`1e14e94`)
- **Problema:** `scrapeProductByUrl` usava Playwright diretamente na URL do ML em produção. O Railway IP triggava CAPTCHA do ML e o scraper retornava vazio.
- **Fix:** `scraper-product.ts` refatorado para usar a API REST do ML (`/sites/MLB/items/{id}`) como fonte primária de dados (título, preço, imagem, avaliação). Playwright mantido como fallback caso a API falhe. A API ML não tem CAPTCHA e retorna JSON estruturado.
- **Como testar:** `POST /api/offers/import` com qualquer URL MLB em produção.

**2. `tsc` não encontrado no build** (`2106a1b`)
- **Problema:** `Dockerfile` usava `npm ci --omit=dev` que não instalava `typescript` (devDependency). O `RUN tsc` falhava com "command not found".
- **Fix:** Removido `--omit=dev` do `npm ci` no Dockerfile. `tsc` precisa estar disponível no momento do build; o container final ainda roda só o `dist/` compilado.

**3. `better-sqlite3` quebra o build Railway** (`d1279ef`)
- **Problema:** `better-sqlite3` é um native addon (compilado em C++) que exigia ferramentas de build (`python`, `make`, `g++`) no container e falhava em `node:20-slim`. Além disso, `migrate-to-pg.ts` estava sendo compilado pelo `tsc` e referenciava `better-sqlite3`, causando erro de tipo mesmo sem a dep.
- **Fix:** Removido `better-sqlite3` do `package.json`. Adicionado `"exclude": ["src/migrate-to-pg.ts"]` no `tsconfig.json` do backend (o script de migração local é one-shot, não faz parte do build de produção).

**4. Prisma não encontra engine OpenSSL em `node:20-slim`** (`d7a0838`)
- **Problema:** `prisma generate` sem `binaryTargets` gera apenas o engine para a plataforma local (macOS/Windows). Em `node:20-slim` (Debian bookworm), o runtime é `debian-openssl-3.0.x` — Prisma não achava o engine e lançava erro de linking ao iniciar.
- **Fix:** Adicionado `binaryTargets = ["native", "debian-openssl-3.0.x"]` no `generator client` do `schema.prisma`. Isso força o `prisma generate` a incluir o engine Debian junto com o engine nativo.
- **Nota:** `"native"` deve ser mantido para o ambiente local de dev continuar funcionando.

### Renovar sessão ML no Railway
Quando o hub/coupon scraper começar a falhar (sessão expirada, semanas depois):
1. Rodar `npm run test:hub` local (abre browser para login)
2. Minificar: `node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('packages/.ml-session.json','utf8'))))"`
3. Atualizar env `ML_SESSION_JSON` no Railway → redeploy automático

### Vercel (frontend)
- Root Directory: `packages/frontend`
- Env vars:
  - `NEXT_PUBLIC_API_URL=https://aware-recreation-production-0d45.up.railway.app`
  - `NEXT_PUBLIC_SITE_URL` — adicionar quando tiver domínio próprio (afeta só sitemap.xml)

### Deploy escopado por path (evita redeploy cruzado) (`0c98052`)
- **Problema:** Railway e Vercel redeployavam os dois a cada push, mesmo quando a mudança era só em `packages/backend` ou só em `packages/frontend`.
- **Fix:**
  - `railway.toml` → `[build].watchPatterns` restringe o Railway a redeployar só quando mudar `packages/backend/**`, `packages/frontend/package.json`, `package.json`, `package-lock.json`, `Dockerfile` ou `railway.toml`.
  - `packages/frontend/vercel.json` (novo) → `ignoreCommand` compara `git diff HEAD^ HEAD` contra `packages/frontend` + manifests da raiz; se nada relevante mudou, a Vercel pula o build.
- **Trade-off aceito:** se uma dependência só do backend for adicionada, `package-lock.json` raiz muda e ainda aciona rebuild da Vercel (não dá pra diferenciar por workspace sem lockfile por pacote). Na prática é raro e o build é rápido de pular manualmente se precisar.

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
- [x] **Fix URLs com variação ML** — scraper detecta `wid` na URL original e monta `produto.mercadolivre.com.br/MLB-XXXXXXX`; `buildAffiliateLink` preserva o domínio correto ✅
- [x] **`couponMinValue` no frontend** — backend faz join com `Coupon` e retorna campo em ambos os endpoints; badge exibe `mín. R$X`; box exibe aviso de valor mínimo ✅
- [x] **`BackButton`** — componente client que usa `history.back()` preservando página do feed; fallback `href="/"` para acesso direto ✅
- [x] **Badge "⚡ Oferta especial!"** — exibido quando `discountPct === 0`, em roxo, substituindo o `-0% OFF` ✅
- [x] **`POST /api/offers/import`** — endpoint implementado: scrapa com Playwright (`networkidle` + waitForSelector), posta no Telegram imediatamente; `source='manual'` bypassa filtro de desconto; `couponCode` + `couponMinValue` devem ir juntos (sem `couponDiscount`); upsert no `Coupon` para o frontend mostrar o valor mínimo ✅
- [x] **`/admin/import`** — página Next.js com formulário de import manual; URL + par opcional cupom/valor-mínimo; validação inline; card de resultado mostrando se foi postado; sem autenticação por ora ✅
- [x] **SEO og:image** — `generateMetadata` em `oferta/[id]/page.tsx` gera `og:title`, `og:description`, `og:image` (usa `offer.imageUrl`) e Twitter Card para cada produto ✅
- [x] **`sitemap.ts`** — gerado dinamicamente via `app/sitemap.ts`; inclui home, todas as categorias e até 500 ofertas recentes; lê `NEXT_PUBLIC_SITE_URL` (adicionar ao `.env`) ✅
- [x] **Bug scraper de produto — fragmento `#`** — URLs com `#polycard_client=...&wid=...` (links de busca ML) agora são tratadas corretamente: fragmento strippado antes da navegação, `wid` detectado com `[?&#]` ✅
- [x] **Deploy Railway + Vercel** — backend em `aware-recreation-production-0d45.up.railway.app`, frontend em `foxpromocoes.vercel.app` ✅
- [x] **Banco migrado para PostgreSQL** — Railway Postgres, migration baseline PG criada, dados locais migrados via `migrate-to-pg.ts` ✅
- [x] **`ML_SESSION_JSON`** — sessão ML injetada via env var no Railway; `auth.ts` escreve no disco antes de usar; `headless: true` em `NODE_ENV=production` ✅
- [x] **Dockerfile** — `node:20-slim` + `playwright install --with-deps chromium`; `prisma migrate deploy` no CMD ✅
- [x] **Fix build Railway — CAPTCHA no scraper** — `scraper-product.ts` usa API REST ML (`/sites/MLB/items/{id}`) como fonte primária; Playwright mantido como fallback; evita CAPTCHA em IPs de servidor ✅
- [x] **Fix build Railway — `tsc` não encontrado** — removido `--omit=dev` do `npm ci` no Dockerfile; `typescript` precisa estar disponível no build ✅
- [x] **Fix build Railway — `better-sqlite3` native addon** — removido do `package.json`; `migrate-to-pg.ts` excluído do `tsconfig.json` (script one-shot, não faz parte do build de prod) ✅
- [x] **Fix build Railway — Prisma OpenSSL engine** — adicionado `binaryTargets = ["native", "debian-openssl-3.0.x"]` no `schema.prisma`; `node:20-slim` usa Debian bookworm que requer esse engine ✅
- [x] **Deploy escopado por path** — `railway.toml` (`watchPatterns`) e `packages/frontend/vercel.json` (`ignoreCommand`) evitam que um push só no backend redeploye a Vercel e vice-versa ✅
- [x] **Barra de pesquisa no frontend** — `<SearchBar />` (client component) no header, form GET para `/`; parâmetro `?q=` em `GET /api/offers` (Prisma `contains` + `mode: 'insensitive'`); `page.tsx` lê `searchParams.q`, propaga nas tabs/paginação, mostra "Resultados para X" e estado vazio dedicado ✅
- [x] **Endpoints admin de jobs** — `POST /api/admin/job/{offers,hub,post,repost}` implementados em `api/routes/admin.ts`; fire-and-forget (retornam imediatamente); protegidos por `Authorization: Bearer ADMIN_SECRET` ✅
- [x] **Rota admin protegida** — `middleware.ts` no frontend protege `/admin/*`; login via `POST /api/admin/login`; cookie httpOnly `admin_token` com 7 dias; logout via `POST /api/admin/logout` ✅
- [x] **Painel admin — dashboard** — `/admin` com botões de disparo para os 4 jobs; proxy `/api/admin/job/[job]` valida cookie server-side e repassa ao backend com bearer token ✅
- [ ] **Proteção de votos server-side** — rate limit por IP ou tabela `Vote` com constraint única — implementar junto com autenticação
- [ ] Autenticação de usuários (NextAuth ou similar) — pré-requisito para comentários e ofertas de usuário
- [ ] Sistema de comentários por oferta
- [ ] Usuários cadastrar ofertas (com aprovação moderada antes de publicar)
- [x] **Multi-provider** — Amazon (tag `foxofertas04-20`), Awin (Kabum 17729 / AliExpress 18879 / Stanley 30599, publisher 2953175) e Shopee (link curto manual até Open API ser aprovada); registry detecta provider pela URL no import; externalId prefixado por plataforma (sem migration); badge de loja nos cards ✅
- [x] **IA migrada para OpenRouter/DeepSeek** — `deepseek/deepseek-chat` via fetch, sem SDK; `@anthropic-ai/sdk` removido; testado com `test:ai` ✅
- [x] **Scraping 100% local** — crons de 6h/7h e endpoints admin `job/offers`/`job/hub` removidos do Railway; `npm run scrape[:ml|:hub|:amazon]` grava direto no Postgres Railway ✅
- [x] **Shopee** — feed de produto diário (`scrape:shopee`, 7h40/21h40) + link de afiliado automático (`an_redir` + `SHOPEE_AFFILIATE_ID`) ✅
- [x] **ML e Amazon agendados** — 9h30/15h30 com trava de leilão (`leilao-guard.ts`); hub ML continua manual ✅
- [x] **Awin product feeds** — `scrape:awin` para Kabum (queda de preço via `FeedPrice`) e Stanley; AliExpress fora (feeds em CNY/USD) ✅
- [x] **Hospedagem local** — Postgres no Docker (:5433) + pm2 (backend + frontend) + tarefa `ml-ofertas-pm2-resurrect` no login + Docker Desktop AutoStart ✅
- [x] **Cloudflare Tunnel para a API** — `api-ofertas.emiliano.dev.br` → `127.0.0.1:3001` no tunnel do bot-leilao (`~/.cloudflared/config.yml`); `start-local.ps1` sobe o cloudflared se não estiver rodando. Para trocar config sem derrubar o leilão: subir um 2º conector com a config nova e só então matar o antigo ✅
- [x] **Frontend redesenhado com shadcn/ui + Tailwind v4** — grade responsiva, CTA fixo no mobile, header com busca e chips de categoria ✅
- [x] **Contexto de tendências da IA** — Black Friday/Natal/13º/verão (nov–dez 2026); revisar `TRENDS_CONTEXT` em `ai/index.ts` a cada estação ✅
- [ ] Analytics: Google Analytics 4 ou Plausible — medir cliques nos links de afiliado (conversão)
- [x] Domínio próprio `www.foxpromocoes.com.br` + IndexNow ✅
