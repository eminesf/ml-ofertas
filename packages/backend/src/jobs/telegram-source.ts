import { extractShopeeIds } from '../providers/shopee'
import fs from 'fs'
import { fetchPrivatePosts, userClientConfigured, PrivatePost } from '../channels/telegram/user-client'
import path from 'path'
import { prisma } from '../utils/prisma'
import { resolveProviderByUrl } from '../providers/registry'
import { processOffer } from './offers.job'
import { RawOffer } from '../providers/base.provider'
import { takeWhatsAppSourceMessages } from './whatsapp-source'

// Importa ofertas de canais PÚBLICOS do Telegram (página t.me/s/<canal>, sem login).
// Aproveita só o LINK do produto: resolve o link curto até a loja, descarta o
// afiliado do outro canal, revalida preço com o nosso scraper e passa pela IA.
// O copy e a imagem são nossos — nunca o texto/arte do canal de origem.
//
// TELEGRAM_SOURCES=wolf_ofertas,outro_canal  (padrão: wolf_ofertas)
// TELEGRAM_SOURCE_MAX=8  posts novos por canal a cada rodada

const STATE_FILE = path.join(__dirname, '..', '..', '..', '.telegram-sources.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

interface ChannelPost { id: number; text: string; links: string[]; price: number | null; coupon: string | null; image?: string | null }

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

// Grupos que escrevem o preço sem "R$" ("159 com o cupom X", "3 blisters por 116",
// "355 pela Gigatoys"): número no começo da linha ou depois de "por", seguido de com/pela/pelo/no/na
export function parseLoosePrice(text: string): number | null {
  const strict = parsePrice(text)
  if (strict) return strict
  const m = text.match(/(?:\bpor\s+|^\s*)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{2,5}(?:,\d{1,2})?)\s+(?:com|pela|pelo|no|na|reais)\b/im)
    // Linha só com o número (ex.: "115,99", "308", "🔥 287,99" — grupo Promoções Pokémon)
    || text.match(/^[^\p{L}\p{N}\n]*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{2,5}(?:,\d{1,2})?)[ \t]*$/mu)
  // Ano solto ("2026") não é preço
  if (!m || /^(19|20)\d{2}$/.test(m[1])) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 5 ? n : null
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
    // Foto do post (usada quando a loja não deixa ler a página, ex.: Shopee)
    const image = part.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'/)?.[1] || null
    return { id, text, links, price: parsePrice(text), coupon, image }
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

  // Shopee: só serve se cair num produto (-i.loja.item, /product/ ou /opaanlp/ dos links
  // de afiliado); /m/cupom-de-desconto, /m/espaco-tecnologia e carteira de cupons ficam de fora
  if (/shopee\.com\.br/.test(final)) {
    const ids = extractShopeeIds(final)
    return ids ? { url: `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}` } : null
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
      await handleSourcePost(channel, post)
    }
  }

  // Grupos PRIVADOS (t.me/+HASH): lidos pela conta do dono via MTProto (npm run telegram:login)
  const privateSources = (process.env.TELEGRAM_PRIVATE_SOURCES || '').split(',').map(c => c.trim().replace(/^https?:\/\/t\.me\//, '').replace(/^\+/, '')).filter(Boolean)
  if (privateSources.length && !userClientConfigured()) {
    console.warn('[TgSource] TELEGRAM_PRIVATE_SOURCES definido, mas falta login: rode npm run telegram:login')
  } else {
    for (const hash of privateSources) {
      const key = `private:${hash}`
      let group: { title: string; posts: PrivatePost[] }
      try {
        group = await fetchPrivatePosts(hash)
      } catch (err: any) {
        console.error(`[TgSource] grupo privado ${hash}: falha ao ler — ${err?.message}`)
        continue
      }
      const lastSeen = state[key] ?? 0
      const fresh = group.posts.filter(p => p.id > lastSeen).slice(-maxPerChannel)
      console.log(`[TgSource] ${group.title} (privado): ${group.posts.length} mensagens lidas, ${fresh.length} novas`)
      for (const p of fresh) {
        state[key] = Math.max(state[key] ?? 0, p.id)
        saveState(state)
        const coupon = p.text.match(/cupom:?\s*([A-Z0-9]{5,20})\b/i)?.[1]?.toUpperCase() || null
        await handleSourcePost(group.title, { id: p.id, text: p.text, links: p.links, price: parseLoosePrice(p.text), coupon })
      }
    }
  }

  // Grupos do WhatsApp usados como fonte (jobs/whatsapp-source.ts): o backend guardou as
  // mensagens novas; aqui elas passam pelo mesmo pipeline. Avisos de loja (Nike) muitas vezes
  // não trazem preço — vale o preço lido da loja/feed.
  for (const m of takeWhatsAppSourceMessages().slice(-maxPerChannel)) {
    const links = [...new Set([...m.links, ...(m.text.match(/https?:\/\/[^\s*_~]+/g) || [])])]
      .filter(u => !/chat\.whatsapp\.com|wa\.me\//.test(u))
    const coupon = m.text.match(/cupom:?\s*\*?([A-Z0-9]{4,20})\b/i)?.[1]?.toUpperCase() || null
    await handleSourcePost('whatsapp', { id: 0, text: m.text, links, price: parseLoosePrice(m.text), coupon }, { allowNoPrice: true })
  }
}

// Envio imediato: oferta de canal/grupo é relâmpago (cupom acaba, estoque esgota) —
// esperar a fila de 20 em 20 min atrasava horas. Este job roda em processo filho,
// sem o socket do WhatsApp, então pede o envio para a API do backend.
// TELEGRAM_INSTANT_MAX (padrão 3) por rodada; o excedente vai para a fila com prioridade.
let instantSent = 0
async function sendNow(externalId: string, tag: string, repost = false) {
  const max = parseInt(process.env.TELEGRAM_INSTANT_MAX || '3', 10)
  if (instantSent >= max || !process.env.ADMIN_SECRET) return
  const offer = await prisma.offer.findUnique({
    where: { externalId },
    select: { id: true, telegramMessage: true, imageUrl: true, posts: { select: { id: true }, take: 1 } },
  })
  if (!offer?.telegramMessage || !offer.imageUrl || (offer.posts.length && !repost)) return
  try {
    const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/admin/offer/${offer.id}/send${repost ? '?repost=1' : ''}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
      signal: AbortSignal.timeout(120_000),
    })
    const body: any = await res.json().catch(() => ({}))
    if (res.ok) instantSent++
    console.log(`${tag} envio imediato: ${res.ok ? `telegram:${body.telegram} whatsapp:${body.whatsapp}` : body.error || res.status}`)
  } catch (err: any) {
    console.warn(`${tag} envio imediato falhou (fica na fila): ${err?.message}`)
  }
}

// Um post de canal/grupo → oferta nossa (link resolvido, preço revalidado, IA)
async function handleSourcePost(channel: string, post: ChannelPost, opts: { allowNoPrice?: boolean } = {}) {
  const postPrice = post.price ?? 0
  const tag = `[TgSource][${channel}/${post.id}]`
  // Posts de cupom/lista não têm um produto único — por ora ficam de fora
  if ((!post.price && !opts.allowNoPrice) || !post.links.length || /^\W*cupo(m|ns)\b/i.test(post.text.split('\n')[0])) {
    console.log(`${tag} pulado (sem produto/preço): ${post.text.split('\n')[0].slice(0, 60)}`)
    return
  }

  try {
    // O primeiro link nem sempre é o produto (Shopee: "Resgate o cupom" vem antes do
    // "Produto:"); usa o primeiro link que leva a um produto de loja suportada.
    let product: Awaited<ReturnType<typeof resolveProduct>> = null
    let resolved: ReturnType<typeof resolveProviderByUrl> = null
    for (const link of post.links.slice(0, 4)) {
      const p = await resolveProduct(link).catch(() => null)
      const r = p ? resolveProviderByUrl(p.url) : null
      if (p && r) { product = p; resolved = r; break }
      product = product ?? p
    }
    if (!product || !resolved) {
      console.log(`${tag} loja não suportada ou link sem produto: ${product?.url || post.links[0]}`)
      return
    }

    // Produto que já passou por aqui: se já foi postado e a fonte divulgou de novo depois
    // de um tempo (ou com cupom novo), é promoção nova → reposta com preço/cupom/copy atuais.
    // Ex.: Promoções Pokémon postou o Ditto Copag em 24/11 e de novo em 25/11 com MELIAGORA.
    const existing = await prisma.offer.findUnique({
      where: { externalId: resolved.externalId },
      select: { couponCode: true, posts: { select: { sentAt: true }, orderBy: { sentAt: 'desc' }, take: 1 } },
    })
    let repost = false
    if (existing) {
      const last = existing.posts[0]?.sentAt
      if (!last) {
        console.log(`${tag} ${resolved.externalId} já está no banco (na fila)`)
        return
      }
      const hours = (Date.now() - last.getTime()) / 3_600_000
      const norm = (c?: string | null) => (c || '').replace(/^#/, '').toUpperCase()
      const couponChanged = !!post.coupon && norm(post.coupon) !== norm(existing.couponCode)
      const minHours = parseFloat(process.env.SOURCE_REPOST_HOURS || '12')
      if (hours < minHours && !(couponChanged && hours >= 3)) {
        console.log(`${tag} ${resolved.externalId} já postada há ${hours.toFixed(1)}h, pulando`)
        return
      }
      repost = true
      console.log(`${tag} ${resolved.externalId} divulgada de novo (último post há ${hours.toFixed(1)}h${couponChanged ? `, cupom novo ${post.coupon}` : ''}) → repostando`)
    }

    let raw = product.raw ?? await resolved.scrapeProduct(product.url).catch(() => null)
    // Shopee bloqueia leitura da página e da API: monta o produto com o post de origem
    // (nome na 1ª linha, preço do post, foto do post). Sem preço "de" → a IA decide.
    if (!raw?.salePrice && resolved.provider.name === 'shopee' && post.price && post.image) {
      const title = post.text.split('\n')[0].replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s*[-–]\s*R\$.*$/, '').trim()
      if (title.length >= 8) {
        raw = {
          externalId: resolved.externalId, title, salePrice: post.price, originalPrice: post.price,
          discountPct: 0, imageUrl: post.image, productUrl: product.url,
        } as RawOffer
        console.log(`${tag} Shopee lida pelo post: "${title.slice(0, 60)}" R$${post.price}`)
      }
    }
    if (!raw?.salePrice) {
      console.log(`${tag} não foi possível ler o produto: ${product.url}`)
      return
    }
    // Preço já subiu desde o post de origem → promoção acabou. Post com cupom/Pix
    // mostra o preço final (cupom aplicado), então a tolerância é maior.
    const tolerance = post.coupon || /pix/i.test(post.text) ? 1.35 : 1.1
    if (postPrice && raw.salePrice > postPrice * tolerance) {
      console.log(`${tag} preço subiu (canal R$${post.price} → loja R$${raw.salePrice}), pulando`)
      return
    }

    // Cupom público da loja citado no post (ex.: SITETODO2211 do ML) vai junto no nosso copy
    if (post.coupon) console.log(`${tag} cupom no post: ${post.coupon}`)
    // Texto do post (sem links) vai para o copy: cupom, preço com cupom, condições
    const sourceNote = post.text.replace(/https?:\/\/\S+/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 400)
    await processOffer({ ...raw, externalId: resolved.externalId, sourceNote }, resolved.provider, post.coupon || undefined, 'telegram',
      undefined, undefined, undefined, false, undefined, repost)
    await sendNow(resolved.externalId, tag, repost)
  } catch (err: any) {
    console.error(`${tag} erro:`, err?.message || err)
  }
}
