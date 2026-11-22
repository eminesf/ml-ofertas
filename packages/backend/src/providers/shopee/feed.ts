import { RawOffer } from '../base.provider'
import { classifyCategory } from '../../utils/category'

// Feed de produto do portal de afiliados (affiliate.shopee.com.br → Criativo →
// Feed de produto → "Ver Link"): CSV com 10 mil produtos por arquivo,
// atualizado todo dia. O download não pede login — o `id` da URL identifica a
// conta, então as URLs ficam só no .env (SHOPEE_FEED_URLS, separadas por vírgula).
//
// Colunas: itemid, title, price (preço cheio), sale_price, discount_percentage,
// item_rating, image_link, product_link (shopee.com.br/product/{shop}/{item}),
// global_category1/2 (em inglês). O "product_short link" vem SEM affiliate_id —
// o link de afiliado é montado por ShopeeProvider.buildAffiliateLink.

const DEFAULT_MAX = 20
const MIN_DISCOUNT = 20
// Desconto muito alto na Shopee costuma ser preço "de" inflado — a IA ainda
// filtra, mas nem chega a gastar chamada com isso.
const MAX_DISCOUNT = 70
const MIN_RATING = 4.5
const MIN_PRICE = 10
const MAX_POR_LOJA = 2

function num(v: string | undefined): number {
  const n = parseFloat(v ?? '')
  return isFinite(n) ? n : 0
}

export function feedRowToRawOffer(row: Record<string, string>): RawOffer | null {
  const m = (row.product_link ?? '').match(/\/product\/(\d+)\/(\d+)/)
  if (!m || !row.title) return null
  const [, shopId, itemId] = m
  const salePrice = num(row.sale_price) || num(row.price)
  const price = num(row.price)
  if (salePrice <= 0) return null
  const originalPrice = price > salePrice ? price : salePrice
  const discountPct = originalPrice > salePrice ? Math.round((1 - salePrice / originalPrice) * 100) : 0
  const rating = num(row.item_rating)
  return {
    externalId: `SHOPEE-${shopId}-${itemId}`,
    title: row.title,
    originalPrice,
    salePrice,
    discountPct,
    imageUrl: row.image_link || undefined,
    productUrl: `https://shopee.com.br/product/${shopId}/${itemId}`,
    category: classifyCategory(row.title),
    rating: rating > 0 && rating <= 5 ? rating : undefined,
  }
}

const COLUNAS = ['itemid', 'title', 'price', 'sale_price', 'item_rating', 'image_link', 'product_link']

/** CSV (RFC 4180) guardando só as COLUNAS acima. Recorta cada campo por
 *  índice em vez de montar caractere a caractere: o parser genérico da Awin
 *  estourou a memória com os 22 MB de descrições longas do feed da Shopee. */
export function parseFeedCsv(text: string): Record<string, string>[] {
  const linhas: Record<string, string>[] = []
  let header: string[] | null = null
  let manter: Map<number, string> | null = null
  let registro: Record<string, string> = {}
  let campos: string[] = []
  let col = 0
  let i = 0
  const n = text.length

  const fimDoRegistro = () => {
    if (!header) {
      header = campos.map(h => h.trim())
      manter = new Map(header.map((h, idx) => [idx, h] as [number, string]).filter(([, h]) => COLUNAS.includes(h)))
    } else if (col > 1 || Object.keys(registro).length) {
      linhas.push(registro)
    }
    registro = {}
    campos = []
    col = 0
  }
  const guardar = (valor: string) => {
    if (!header) campos.push(valor)
    else {
      const nome = manter!.get(col)
      if (nome) registro[nome] = valor.trim()
    }
    col++
  }

  while (i < n) {
    let valor: string
    if (text[i] === '"') {
      let j = i + 1
      let temAspasDuplas = false
      for (;;) {
        const q = text.indexOf('"', j)
        if (q === -1) { j = n; break }
        if (text[q + 1] === '"') { temAspasDuplas = true; j = q + 2; continue }
        j = q
        break
      }
      valor = text.slice(i + 1, j)
      if (temAspasDuplas) valor = valor.replace(/""/g, '"')
      i = j + 1
    } else {
      let j = i
      while (j < n && text[j] !== ',' && text[j] !== '\n' && text[j] !== '\r') j++
      valor = text.slice(i, j)
      i = j
    }
    guardar(valor)
    if (i >= n) { fimDoRegistro(); break }
    const c = text[i]
    if (c === ',') { i++; if (i >= n) { guardar(''); fimDoRegistro() } }
    else if (c === '\r' || c === '\n') {
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1
      fimDoRegistro()
    } else i++
  }
  return linhas
}

async function downloadFeed(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Shopee feed HTTP ${res.status}`)
  // BOM no início do cabeçalho ("\uFEFFimage_link")
  const text = (await res.text()).replace(/^\uFEFF/, '')
  return parseFeedCsv(text)
}

export async function scrapeShopeeFeed(): Promise<RawOffer[]> {
  const urls = (process.env.SHOPEE_FEED_URLS ?? '').split(',').map(u => u.trim()).filter(Boolean)
  if (!urls.length) {
    console.error('[Shopee] SHOPEE_FEED_URLS não configurada — pulando feed')
    return []
  }

  const seen = new Set<string>()
  const offers: RawOffer[] = []
  let linhas = 0
  for (const [i, url] of urls.entries()) {
    try {
      const rows = await downloadFeed(url)
      linhas += rows.length
      for (const row of rows) {
        const o = feedRowToRawOffer(row)
        if (!o || seen.has(o.externalId)) continue
        seen.add(o.externalId)
        offers.push(o)
      }
    } catch (err) {
      console.error(`[Shopee] Feed ${i + 1}/${urls.length} falhou:`, err)
    }
  }

  const max = parseInt(process.env.SHOPEE_FEED_MAX || String(DEFAULT_MAX), 10)
  const porLoja = new Map<string, number>()
  const best = offers
    .filter(o =>
      o.discountPct >= MIN_DISCOUNT && o.discountPct <= MAX_DISCOUNT &&
      (o.rating ?? 0) >= MIN_RATING && o.salePrice >= MIN_PRICE,
    )
    // Nota primeiro (desconto alto sozinho costuma ser preço "de" inflado), desconto desempata
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.discountPct - a.discountPct)
    // No máx. MAX_POR_LOJA por loja: senão poucas lojas com "de" inflado tomam a lista
    .filter(o => {
      const loja = o.externalId.split('-')[1]
      porLoja.set(loja, (porLoja.get(loja) ?? 0) + 1)
      return porLoja.get(loja)! <= MAX_POR_LOJA
    })
    .slice(0, max)

  console.log(`[Shopee] ${linhas} linhas → ${offers.length} válidas → ${best.length} com desconto ${MIN_DISCOUNT}-${MAX_DISCOUNT}% e nota ≥ ${MIN_RATING} (máx ${max})`)
  return best
}
