import { gunzipSync } from 'zlib'
import { RawOffer } from '../base.provider'
import { AwinAdvertiser, awinExternalId } from './index'
import { classifyCategory } from '../../utils/category'
import { prisma } from '../../utils/prisma'

// Product feeds da Awin (datafeed API) — scraping de listagem de Kabum/AliExpress/Stanley.
// A chave fica em Ferramentas → Crie um Feed → URL "Download da Lista de Feed"
// (segmento de 32 hex entre /2953175/ e /1/feedList) → AWIN_FEED_API_KEY no .env.

const FEED_BASE = 'https://productdata.awin.com/datafeed/download/apikey'

// Colunas padrão Awin; anunciante que não tem a coluna devolve vazio
const COLUMNS = [
  'aw_product_id', 'merchant_product_id', 'product_name', 'merchant_deep_link',
  'merchant_image_url', 'aw_image_url', 'search_price', 'rrp_price', 'product_price_old',
  'base_price', 'savings_percent', 'currency', 'in_stock', 'stock_quantity', 'stock_status',
  'category_name', 'merchant_category', 'rating',
]

// Teto de produtos por anunciante que seguem para o pipeline (cada um custa chamadas de IA)
const DEFAULT_MAX_PER_ADVERTISER = 30
const MIN_FEED_DISCOUNT = 20

interface FeedRow { [col: string]: string }

function feedUrl(apiKey: string, feedIds: string[]): string {
  return `${FEED_BASE}/${apiKey}/language/any/fid/${feedIds.join(',')}/columns/${COLUMNS.join(',')}/format/csv/delimiter/%2C/compression/gzip/`
}

// Parser CSV RFC 4180 (aspas, vírgulas e quebras de linha dentro de campos)
export function parseCsv(text: string): FeedRow[] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { record.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.some(f => f !== '')) records.push(record)
      record = []
    } else field += c
  }
  if (field !== '' || record.length) { record.push(field); records.push(record) }

  const [header, ...rows] = records
  if (!header) return []
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

function toNumber(value: string | undefined): number {
  if (!value) return 0
  // Feeds BR às vezes vêm com "1.299,90"; o padrão Awin é "1299.90"
  const normalized = /,\d{1,2}$/.test(value) ? value.replace(/\./g, '').replace(',', '.') : value
  const n = parseFloat(normalized.replace(/[^\d.]/g, ''))
  return isFinite(n) ? n : 0
}

function isInStock(row: FeedRow): boolean {
  if (row.in_stock) return row.in_stock !== '0' && row.in_stock.toLowerCase() !== 'false'
  if (row.stock_status) return !/out|esgotad|indispon/i.test(row.stock_status)
  if (row.stock_quantity) return toNumber(row.stock_quantity) > 0
  return true
}

export function rowToRawOffer(row: FeedRow, advertiser: AwinAdvertiser): RawOffer | null {
  const title = row.product_name
  const productUrl = row.merchant_deep_link
  const salePrice = toNumber(row.search_price)
  if (!title || !productUrl || salePrice <= 0) return null
  if (row.currency && row.currency.toUpperCase() !== 'BRL') return null
  if (!isInStock(row)) return null

  // Preço "de": primeiro campo de preço cheio que for maior que o preço atual
  let originalPrice = [row.rrp_price, row.product_price_old, row.base_price]
    .map(toNumber)
    .find(p => p > salePrice) || 0

  // Alguns feeds (AliExpress) só trazem savings_percent
  const savings = toNumber(row.savings_percent)
  if (!originalPrice && savings > 0 && savings < 100) {
    originalPrice = Math.round((salePrice / (1 - savings / 100)) * 100) / 100
  }
  if (!originalPrice) originalPrice = salePrice

  const discountPct = originalPrice > salePrice ? Math.round((1 - salePrice / originalPrice) * 100) : 0
  const cleanUrl = productUrl.split('#')[0]
  const rating = toNumber(row.rating)

  return {
    externalId: awinExternalId(advertiser, cleanUrl),
    title,
    originalPrice,
    salePrice,
    discountPct,
    imageUrl: row.merchant_image_url || row.aw_image_url || undefined,
    productUrl: cleanUrl,
    category: classifyCategory(title),
    rating: rating > 0 && rating <= 5 ? rating : undefined,
  }
}

export async function downloadFeed(apiKey: string, feedIds: string[]): Promise<FeedRow[]> {
  const res = await fetch(feedUrl(apiKey, feedIds))
  if (!res.ok) throw new Error(`Awin feed HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // Awin às vezes devolve texto puro (erro) mesmo pedindo gzip
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString('utf8') : buf.toString('utf8')
  return parseCsv(text)
}

// Feeds sem preço "de": compara com o preço do scrape anterior (tabela FeedPrice).
// Queda vira desconto com o preço anterior como originalPrice; depois grava os preços atuais.
// Primeiro scrape só forma a base — nenhuma oferta sai até o preço mudar.
async function applyPriceDrops(offers: RawOffer[], advertiser: AwinAdvertiser): Promise<RawOffer[]> {
  const previous = new Map(
    (await prisma.feedPrice.findMany({ where: { provider: advertiser.name } })).map(p => [p.externalId, p.price])
  )

  const fresh: { externalId: string; provider: string; price: number }[] = []
  const changed: RawOffer[] = []
  const result = offers.map(o => {
    const before = previous.get(o.externalId)
    if (before === undefined) {
      fresh.push({ externalId: o.externalId, provider: advertiser.name, price: o.salePrice })
      return o
    }
    if (before === o.salePrice) return o
    changed.push(o)
    if (before > o.salePrice) {
      return { ...o, originalPrice: before, discountPct: Math.round((1 - o.salePrice / before) * 100) }
    }
    return o
  })

  if (fresh.length) await prisma.feedPrice.createMany({ data: fresh, skipDuplicates: true })
  for (let i = 0; i < changed.length; i += 500) {
    await prisma.$transaction(changed.slice(i, i + 500).map(o =>
      prisma.feedPrice.update({ where: { externalId: o.externalId }, data: { price: o.salePrice } })
    ))
  }

  console.log(`[Awin:${advertiser.name}] Histórico de preço: ${previous.size} conhecidos, ${fresh.length} novos, ${changed.length} mudaram`)
  return result
}

export async function scrapeAwinFeed(advertiser: AwinAdvertiser): Promise<RawOffer[]> {
  const apiKey = process.env.AWIN_FEED_API_KEY
  if (!apiKey) {
    console.error(`[Awin:${advertiser.name}] AWIN_FEED_API_KEY não configurada — pulando feed`)
    return []
  }
  if (!advertiser.feedIds?.length) {
    console.log(`[Awin:${advertiser.name}] Sem feedIds configurados`)
    return []
  }

  console.log(`[Awin:${advertiser.name}] Baixando ${advertiser.feedIds.length} feed(s)...`)
  const rows = await downloadFeed(apiKey, advertiser.feedIds)

  const seen = new Set<string>()
  let offers = rows
    .map(r => rowToRawOffer(r, advertiser))
    .filter((o): o is NonNullable<typeof o> => !!o && !seen.has(o.externalId) && !!seen.add(o.externalId))

  if (advertiser.discountSource === 'priceDrop') offers = await applyPriceDrops(offers, advertiser)

  const max = parseInt(process.env.AWIN_FEED_MAX || String(DEFAULT_MAX_PER_ADVERTISER), 10)
  const best = offers
    .filter(o => o.discountPct >= MIN_FEED_DISCOUNT)
    .sort((a, b) => b.discountPct - a.discountPct)
    .slice(0, max)

  console.log(`[Awin:${advertiser.name}] ${rows.length} linhas → ${offers.length} válidas → ${best.length} com desconto ≥ ${MIN_FEED_DISCOUNT}% (máx ${max})`)
  return best
}
