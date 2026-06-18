# ML Afiliados Bot

Bot automatizado de ofertas para afiliados do Mercado Livre com IA.

## Estrutura

```
ml-afiliados/
├── packages/
│   ├── backend/          # Node.js + Express + Prisma
│   └── frontend/         # Next.js — site público de ofertas
├── .env
└── package.json
```

## Setup inicial

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env .env.local
# Editar .env com suas chaves
```

Variáveis necessárias:
- `ANTHROPIC_API_KEY` — chave da API do Claude
- `TELEGRAM_BOT_TOKEN` — token do bot (criar no @BotFather)
- `TELEGRAM_CHANNEL_ID` — ID do canal público (@seucanal)
- `ML_AFFILIATE_ID` — seu ID de afiliado do ML

### 3. Criar o banco de dados
```bash
cd packages/backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Rodar em desenvolvimento
```bash
# Na raiz — roda backend e frontend juntos
npm run dev

# Ou separado:
cd packages/backend && npm run dev   # porta 3001
cd packages/frontend && npm run dev  # porta 3000
```

### 5. Testar o job manualmente
```bash
cd packages/backend
npx tsx src/jobs/scheduler.ts --now
```

## Próximos passos

1. Implementar scraper do ML em `packages/backend/src/providers/mercadolivre/`
2. Criar canal público no Telegram e cadastrar no ML Afiliados
3. Configurar deploy no Railway

## Adicionando novos providers

1. Criar pasta em `src/providers/nomedoprovider/`
2. Implementar a interface `AffiliateProvider` de `base.provider.ts`
3. Adicionar no array `providers` em `src/jobs/scheduler.ts`
