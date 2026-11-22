import fs from 'fs'
import path from 'path'
import { prisma } from '../utils/prisma'
import { resolveProviderByUrl } from '../providers/registry'
import { processOffer } from './offers.job'
import { RawOffer } from '../providers/base.provider'

// Importa ofertas de canais PÚBLICOS do Telegram (página t.me/s/<canal>, sem login).
// Aproveita só o LINK do produto: resolve o link curto até a loja, descarta o
// afiliado do outro canal, revalida preço com o nosso scraper e passa pela IA.
// O copy e a imagem são nossos — nunca o texto/arte do canal de origem.
//
// TELEGRAM_SOURCES=wolf_ofertas,outro_canal  (padrão: wolf_ofertas)
// TELEGRAM_SOURCE_MAX=8  posts novos por canal a cada rodada

const STATE_FILE = path.join(__dirname, '..', '..', '..', '.telegram-sources.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

interface ChannelPost { id: number; text: string; links: string[]; price: number | null; coupon: string | null }

function loadState(): Record<string, number> {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return {} }
}
function saveState(state: Record<string, number>) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function decode(s: string): string {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim()
}

function parsePrice(text: string): number | null {
  const m = text.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function fetchChannelPosts(channel: string): Promise<ChannelPost[]> {
  const res = await fetch(`https://t.me/s/${channel}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`t.me/s/${channel} → ${res.status}`)
  const html = await res.text()
  const parts = html.split(`data-post="${channel}/`).slice(1)
  return parts.map(part => {
    const id = parseInt(part, 10)
    const textHtml = part.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''
    const text = decode(textHtml)
    const links = [...textHtml.matchAll(/href="(https?:\/\/[^"]+)"/g)]
      .map(m => m[1].replace(/&amp;/g, '&'))
      .filter(u => !/t\.me\/|telegram\.(org|me)/.test(u))
    const coupon = text.match(/cupom:?\s*([A-Z0-9]{5,20})\b/i)?.[1]?.toUpperCase() || null
    return { id, text, links, price: parsePrice(text), coupon }
  }).filter(p => Number.isFinite(p.id))
}

// Polycards do Mercado Livre vêm como JSON no HTML (título, preços, foto, id do anúncio)
function extractPolycards(html: string): any[] {
  const start = html.indexOf('"polycards":[')
  if (start < 0) return []
  let i = html.indexOf('[', start), depth = 0, inStr = false
  for (let k = i; k < html.length; k++) {
    const ch = html[k]
    if (inStr) { if (ch === '\\') k++; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(i, k + 1)) } catch { return [] } } }
  }
  return []
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// meli.la cai no perfil "social" do afiliado: o produto divulgado é o polycard cujo
// título bate com o og:title da página (o primeiro card nem sempre é ele)
function mlFromSocialPage(html: string): RawOffer | null {
  const ogTitle = decode(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || '').replace(/\s+-\s+R\$.*$/, '')
  if (!ogTitle) return null
  const want = norm(ogTitle).slice(0, 40)
  const card = extractPolycards(html).find(c => {
    const t = c.components?.find((x: any) => x.type === 'title')?.title?.text
    return t && norm(t).startsWith(want.slice(0, 30))
  })
  if (!card) return null
  const id: string = card.metadata?.id
  const title: string = card.components.find((x: any) => x.type === 'title').title.text
  const price = card.components.find((x: any) => x.type === 'price')?.price
  const salePrice = price?.current_price?.value
  if (!id || !salePrice) return null
  const originalPrice = price?.previous_price?.value && price.previous_price.value > salePrice ? price.previous_price.value : salePrice
  const pic = card.pictures?.pictures?.[0]?.id
  return {
    externalId: id,
    title,
    salePrice,
    originalPrice,
    discountPct: originalPrice > salePrice ? Math.round((1 - salePrice / originalPrice) * 100) : 0,
    imageUrl: pic ? `https://http2.mlstatic.com/D_NQ_NP_${pic}-O.webp` : undefined,
    productUrl: `https://produto.mercadolivre.com.br/MLB-${id.slice(3)}`,
  } as RawOffer
}

// Segue o link curto até a loja. Devolve a URL limpa do produto e, quando a
// própria página já traz os dados (ML social), o produto pronto.
export async function resolveProduct(shortUrl: string): Promise<{ url: string; raw?: RawOffer } | null> {
  const res = await fetch(shortUrl, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  const final = res.url

  if (/mercadoli(vre|bre)\.com/.test(final)) {
    if (/MLB-?\d{6,}/.test(final) && !/\/social\//.test(final)) return { url: final.split('?')[0].split('#')[0] }
    const raw = mlFromSocialPage(await res.text())
    return raw ? { url: raw.productUrl, raw } : null
  }

  // AliExpress: link de afiliado cai numa landing com productIds=
  if (/aliexpress\./.test(final)) {
    const id = final.match(/productIds=(\d+)/)?.[1] || final.match(/\/item\/(\d+)\.html/)?.[1]
    return id ? { url: `https://pt.aliexpress.com/item/${id}.html` } : null
  }

  // Shopee: só serve se cair na página do produto (alguns links vão para o carrinho)
  if (/shopee\.com\.br/.test(final)) {
    return /-i\.\d+\.\d+|\/product\/\d+\/\d+/.test(final) ? { url: final.split('?')[0] } : null
  }

  return { url: final.split('#')[0] }
}

export async function runTelegramSourceJob() {
  const channels = (process.env.TELEGRAM_SOURCES || 'wolf_ofertas').split(',').map(c => c.trim().replace(/^@/, '')).filter(Boolean)
  const maxPerChannel = parseInt(process.env.TELEGRAM_SOURCE_MAX || '8', 10)
  const state = loadState()

  for (const channel of channels) {
    let posts: ChannelPost[]
    try {
      posts = await fetchChannelPosts(channel)
    } catch (err: any) {
      console.error(`[TgSource] ${channel}: falha ao ler canal — ${err?.message}`)
      continue
    }

    const lastSeen = state[channel] ?? 0
    // Primeira vez: começa pelos posts mais recentes, não pelo histórico todo
    const fresh = posts.filter(p => p.id > lastSeen).slice(-maxPerChannel)
    console.log(`[TgSource] ${channel}: ${posts.length} posts na página, ${fresh.length} novos`)

    for (const post of fresh) {
      state[channel] = Math.max(state[channel] ?? 0, post.id)
      saveState(state)

      const tag = `[TgSource][${channel}/${post.id}]`
      // Posts de cupom/lista não têm um produto único — por ora ficam de fora
      if (!post.price || !post.links.length || /^\W*cupo(m|ns)\b/i.test(post.text.split('\n')[0])) {
        console.log(`${tag} pulado (sem produto/preço): ${post.text.split('\n')[0].slice(0, 60)}`)
        continue
      }

      try {
        const product = await resolveProduct(post.links[0])
        const resolved = product ? resolveProviderByUrl(product.url) : null
        if (!product || !resolved) {
          console.log(`${tag} loja não suportada ou link sem produto: ${product?.url || post.links[0]}`)
          continue
        }

        if (await prisma.offer.findUnique({ where: { externalId: resolved.externalId }, select: { id: true } })) {
          console.log(`${tag} ${resolved.externalId} já está no banco`)
          continue
        }

        const raw = product.raw ?? await resolved.scrapeProduct(product.url)
        if (!raw?.salePrice) {
          console.log(`${tag} não foi possível ler o produto: ${product.url}`)
          continue
        }
        // Preço já subiu desde o post de origem → promoção acabou. Post com cupom/Pix
        // mostra o preço final (cupom aplicado), então a tolerância é maior.
        const tolerance = post.coupon || /pix/i.test(post.text) ? 1.25 : 1.1
        if (raw.salePrice > post.price * tolerance) {
          console.log(`${tag} preço subiu (canal R$${post.price} → loja R$${raw.salePrice}), pulando`)
          continue
        }

        // Cupom público da loja citado no post (ex.: SITETODO2211 do ML) vai junto no nosso copy
        if (post.coupon) console.log(`${tag} cupom no post: ${post.coupon}`)
        await processOffer({ ...raw, externalId: resolved.externalId }, resolved.provider, post.coupon || undefined, 'telegram')
      } catch (err: any) {
        console.error(`${tag} erro:`, err?.message || err)
      }
    }
  }
}
