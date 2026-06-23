# Fix — URLs de produtos do Mercado Livre

## Contexto
O scraper atual limpa a URL do produto fazendo `productUrl.split('?')[0]`, o que gera
dois problemas:

1. Produtos com variação (cor, tamanho) perdem o `wid` e a URL `/p/MLB...` gerada não funciona
2. O link de afiliado fica quebrado para esses produtos

## Como o ML estrutura as URLs

### Tipo 1 — Produto multi-vendedor (sem variação)
```
https://www.mercadolivre.com.br/p/MLB35162005
```
- Vários vendedores competindo
- O ML mostra o menor preço
- URL `/p/MLB...` funciona normalmente com `matt_tool` e `matt_word`

### Tipo 2 — Produto com variação (cor, tamanho, modelo)
```
https://produto.mercadolivre.com.br/MLB-4071248283-calca-feminina-..._JM
```
- Um vendedor com múltiplas variações
- Domínio diferente: `produto.mercadolivre.com.br`
- ID no formato `MLB-XXXXXXX` (com hífen)
- A URL `/p/MLB...` NÃO funciona para esses produtos

## Como identificar o tipo na URL original do scraper

A URL bruta coletada pelo scraper antes de limpar a query string contém o parâmetro `wid`
quando o produto tem variação:

```
https://www.mercadolivre.com.br/p/MLB64311324?pdp_filters=deal%3A...&wid=MLB4439746393
                                                                       ^^^ item ID real
```

Quando não tem `wid`, é multi-vendedor e a `/p/` funciona normalmente.

## Fix a implementar

No arquivo `packages/backend/src/providers/mercadolivre/index.ts`, dentro do
`page.evaluate()`, substitua a lógica de `cleanUrl` atual por:

```typescript
const productUrl = linkEl?.href || ''

// Tenta extrair wid (presente em produtos com variação)
const widMatch = productUrl.match(/[?&]wid=(MLB\d+)/)

let cleanUrl: string
if (widMatch) {
  // Produto com variação — monta URL do item específico
  // MLB4439746393 → MLB-4439746393
  const itemId = widMatch[1].replace('MLB', 'MLB-')
  cleanUrl = `https://produto.mercadolivre.com.br/${itemId}`
} else {
  // Produto multi-vendedor — limpa query string, mantém /p/
  cleanUrl = productUrl.split('?')[0]
}
```

## Resultado esperado após o fix

```typescript
// Produto multi-vendedor — continua igual
{
  productUrl: "https://www.mercadolivre.com.br/p/MLB35162005",
  affiliateUrl: "https://www.mercadolivre.com.br/p/MLB35162005?matt_tool=28042140&matt_word=fuchsecommerce"
}

// Produto com variação — agora usa URL correta
{
  productUrl: "https://produto.mercadolivre.com.br/MLB-4071248283",
  affiliateUrl: "https://produto.mercadolivre.com.br/MLB-4071248283?matt_tool=28042140&matt_word=fuchsecommerce"
}
```

## Validação

Após implementar, rode o test-scraper e confirme que:
1. Nenhuma oferta tem `productUrl` com query string
2. Produtos com variação usam `produto.mercadolivre.com.br`
3. Produtos multi-vendedor usam `www.mercadolivre.com.br/p/`
4. Todos os `affiliateUrl` contêm `matt_tool=28042140&matt_word=fuchsecommerce`

```bash
cd packages/backend
npx tsx src/test-scraper.ts
```

Verifique no output que as URLs estão no formato correto antes de prosseguir.
