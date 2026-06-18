# ML Afiliados Bot — Contexto do Projeto

## O que é
Bot automatizado de ofertas para afiliados do Mercado Livre. Scrapa ofertas públicas do ML, avalia com IA (Claude), gera copy chamativo e posta em canal público do Telegram. Site Next.js exibe as ofertas e serve como plataforma cadastrada no programa de afiliados.

## Stack
- **Monorepo** npm workspaces
- **Backend**: Node.js + TypeScript + Express + Prisma + SQLite + node-cron + Playwright
- **Frontend**: Next.js 15 (App Router)
- **IA**: Claude API (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`
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
│   │       │   ├── base.provider.ts       # interface AffiliateProvider
│   │       │   └── mercadolivre/index.ts  # scraper ML
│   │       ├── jobs/
│   │       │   ├── offers.job.ts          # pipeline principal
│   │       │   └── scheduler.ts           # node-cron a cada 3h
│   │       ├── ai/index.ts                # evaluateOffer + generatePostMessage
│   │       ├── channels/telegram/index.ts # sendMessage + sendPhoto
│   │       ├── api/routes/
│   │       │   ├── offers.ts              # GET /api/offers
│   │       │   └── posts.ts               # GET /api/posts
│   │       ├── utils/prisma.ts            # singleton PrismaClient
│   │       └── index.ts                   # Express entry point (porta 3001)
│   └── frontend/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   └── page.tsx               # grid de ofertas (SSR)
│           ├── components/OfferCard.tsx
│           └── lib/api.ts                 # fetch do backend
├── .env
└── package.json                           # concurrently dev
```

## Variáveis de ambiente (.env)
```env
ANTHROPIC_API_KEY=
TELEGRAM_BOT_TOKEN=          # @BotFather
TELEGRAM_CHANNEL_ID=         # @seucanal (canal público)
ML_AFFILIATE_ID=28042140     # matt_tool do ML Afiliados
ML_AFFILIATE_WORD=fuchsecommerce  # matt_word / prefixo do afiliado
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Banco de dados (SQLite via Prisma)
```prisma
model Offer {
  id            String   @id @default(cuid())
  externalId    String   @unique   // MLB123456
  provider      String             // "mercadolivre"
  title         String
  originalPrice Float
  salePrice     Float
  discountPct   Int
  imageUrl      String?
  productUrl    String
  affiliateUrl  String
  category      String?
  rating        Float?
  aiScore       Int?               // 0-10 avaliação da IA
  couponAmount  String?            // "R$30 OFF" — cupom embutido no card
  createdAt     DateTime @default(now())
  posts         Post[]
}

model Coupon {
  id         String    @id @default(cuid())
  provider   String
  code       String                // ex: "#FUCHS20OFF"
  discount   String                // "R$20 OFF" ou "10%"
  minValue   Float?
  category   String?
  expiresAt  DateTime?
  active     Boolean   @default(true)
  createdAt  DateTime  @default(now())
}

model Post {
  id        String   @id @default(cuid())
  offerId   String
  offer     Offer    @relation(fields: [offerId], references: [id])
  channel   String   // "telegram"
  message   String
  sentAt    DateTime @default(now())
  success   Boolean  @default(true)
}
```

## Pipeline do job (offers.job.ts)
1. `provider.scrapeOffers()` — Playwright scrapa `mercadolivre.com.br/ofertas`
2. Filtra desconto < 20% (MIN_DISCOUNT)
3. Checa deduplicação no banco por `externalId`
4. `evaluateOffer()` — Claude API dá score 0-10
5. Descarta score < 6 (MIN_AI_SCORE)
6. `provider.buildAffiliateLink()` — injeta `matt_tool` e `matt_word` na URL
7. `generatePostMessage()` — Claude gera copy chamativo
8. Salva `Offer` no banco
9. `sendPhoto()` ou `sendMessage()` no Telegram
10. Salva `Post` no banco
11. Pausa 2s entre posts

## Scraper ML (status atual)
- Funciona com `headless: true` + user-agent real + `AutomationControlled` desativado
- Usa `page.evaluate()` (não `$$eval`) para evitar problema de `__name` injetado pelo tsx
- Seletores confirmados via debug:
  - Cards: `.poly-card`
  - Título/link: `a.poly-component__title`
  - Preço original: `s.andes-money-amount--previous`
  - Preço atual: `.poly-price__current .andes-money-amount--cents-superscript`
  - Desconto: `.poly-price__disc_label` (ex: "27% OFF")
  - Imagem: `.poly-component__picture`
  - Avaliação: `.poly-reviews__rating`
  - Cupom no card: `.poly-coupons__pill`
- Retorna 48 ofertas por execução
- `couponAmount` capturado diretamente do card quando disponível

## Links de afiliado
Formato: `URL_PRODUTO?matt_tool=28042140&matt_word=fuchsecommerce`
Exemplo: `https://www.mercadolivre.com.br/p/MLB64311324?matt_tool=28042140&matt_word=fuchsecommerce`

## Cupons personalizados
- Criados manualmente no painel: `mercadolivre.com.br/afiliados/coupons#hub`
- Prefixo: `#FUCHS` + sufixo escolhido (ex: `#FUCHS20OFF`)
- Limite de 9 códigos ativos simultâneos
- Cadastrar manualmente na tabela `Coupon` do banco
- O job busca cupom ativo do mesmo provider antes de gerar o post

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

# Testar scraper manualmente
cd packages/backend
npx tsx src/test-scraper.ts

# Rodar job manualmente
npx tsx src/jobs/scheduler.ts --now
```

## Próximos passos
- [ ] Configurar bot no @BotFather e criar canal público no Telegram
- [ ] Cadastrar canal e site no painel ML Afiliados
- [ ] Preencher ANTHROPIC_API_KEY e TELEGRAM_BOT_TOKEN no .env
- [ ] Testar job completo com `--now`
- [ ] Deploy Railway (backend) + Vercel (frontend)
- [ ] Adicionar seed de cupons manuais no banco
- [ ] Melhorar frontend (filtros por categoria, busca)
- [ ] Adicionar segundo provider (Amazon Afiliados)