import fs from 'fs'
import path from 'path'
import { randomInt } from 'crypto'
import { findAwinAdvertiser, AwinProvider } from '../providers/awin'
import { prisma } from './prisma'
import { shortLink, type ClickSrc } from './publish'
import { SOURCE_MEDIA_DIR as MEDIA_DIR, type SourceMessage } from '../channels/whatsapp'

// Mensagens dos grupos-fonte do WhatsApp (ex.: avisos da Nike) para o /admin/nike.
// A maioria dos posts da Nike é hotsite, lista de produtos ou cupom — o pipeline automático
// (jobs/telegram-source.ts) só entende 1 produto por post e descarta o resto. Aqui cada link
// da loja vira o NOSSO link (deeplink Awin → link curto /r/CODE) e o cupom é destacado,
// para o dono repassar com 1 clique.
//
// Links curtos sem oferta (hotsite, busca) ficam em packages/.short-links.json; o
// GET /api/offers/go/:code cai nele quando o código não é de uma Offer.

const ROOT = path.join(__dirname, '..', '..', '..')
const LOG_FILE = path.join(ROOT, '.whatsapp-sources-log.json')
const LINKS_FILE = path.join(ROOT, '.short-links.json')
const KEEP_MS = 3 * 24 * 3600_000

export type LoggedMessage = SourceMessage
export { MEDIA_DIR }

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

// ---------- histórico das mensagens ----------
export function logSourceMessage(m: LoggedMessage) {
  const log = readJson<LoggedMessage[]>(LOG_FILE, []).filter(q => Date.now() - q.at < KEEP_MS && q.id !== m.id)
  log.push(m)
  fs.writeFileSync(LOG_FILE, JSON.stringify(log.slice(-150)))
  // fotos antigas saem junto com as mensagens
  try {
    const keep = new Set(log.map(q => q.image).filter(Boolean))
    for (const f of fs.readdirSync(MEDIA_DIR)) if (!keep.has(f)) fs.rmSync(path.join(MEDIA_DIR, f), { force: true })
  } catch { /* pasta ainda não existe */ }
}

export function listSourceMessages(): LoggedMessage[] {
  return readJson<LoggedMessage[]>(LOG_FILE, []).filter(q => Date.now() - q.at < KEEP_MS).reverse()
}

export function getSourceMessage(id: string): LoggedMessage | undefined {
  return readJson<LoggedMessage[]>(LOG_FILE, []).find(q => q.id === id)
}

// ---------- links curtos sem oferta ----------
interface ShortLinkEntry { url: string; original: string; provider: string; at: number }
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function getShortLinkEntry(code: string): ShortLinkEntry | undefined {
  return readJson<Record<string, ShortLinkEntry>>(LINKS_FILE, {})[code]
}

async function linkCode(affiliateUrl: string, original: string, provider: string): Promise<string> {
  const links = readJson<Record<string, ShortLinkEntry>>(LINKS_FILE, {})
  const found = Object.entries(links).find(([, v]) => v.url === affiliateUrl)
  if (found) return found[0]
  for (let i = 0; i < 10; i++) {
    let code = ''
    for (let j = 0; j < 6; j++) code += ALPHABET[randomInt(ALPHABET.length)]
    if (links[code] || await prisma.offer.findUnique({ where: { shortCode: code }, select: { id: true } })) continue
    links[code] = { url: affiliateUrl, original, provider, at: Date.now() }
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links))
    return code
  }
  throw new Error('Não foi possível gerar o código do link')
}

// ---------- conversão ----------
const URL_RE = /https?:\/\/[^\s*~<>"']+[^\s*~<>"'.,;:!?)\]]/g
const TRACKING_PARAMS = /^(utm_|awc$|fbclid$|gclid$|ranMID$|ranEAID$|ranSiteID$|siteID$|cjevent$|sub_?id)/i

// Encurtadores: segue o redirect até a loja
async function unshorten(url: string): Promise<string> {
  if (findAwinAdvertiser(url)) return url
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })
    // Deeplink Awin de outra pessoa: o destino real está em ued=
    const u = new URL(res.url)
    const ued = u.searchParams.get('ued') || u.searchParams.get('p')
    return ued && /^https?:/.test(ued) ? ued : res.url
  } catch {
    return url
  }
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return url
  }
}

const COUPON_STOP = new Set(['LIBERADO', 'LIBERADOS', 'VALIDO', 'VÁLIDO', 'ATIVO', 'EXTRA', 'NOVO', 'NOVOS', 'NOVAS', 'PARA', 'DESCONTO', 'APLICADO', 'AUTOMATICO', 'AUTOMÁTICO', 'NO', 'DE', 'OFF', 'PIX', 'NIKE', 'SITE', 'APP'])

const CONNECTORS = new Set(['o', 'a', 'de', 'do', 'da', 'com', 'é', 'e', 'é:', 'seu', 'nosso'])

// Códigos de cupom: palavra em MAIÚSCULAS logo depois de "cupom"/"código", pulando
// conectores e palavras como LIBERADO (ex.: "CUPOM: *NIKE40*", "use o cupom BLACK15",
// "CUPOM LIBERADO: SHOX20").
export function findCoupons(text: string): string[] {
  const out = new Set<string>()
  for (const kw of text.matchAll(/cupo(?:m|ns)|c[óo]digo/giu)) {
    const after = text.slice(kw.index! + kw[0].length, kw.index! + kw[0].length + 50).split('\n')[0]
    const tokens = after.match(/[\p{L}\p{N}]+/gu) || []
    for (const tok of tokens.slice(0, 4)) {
      if (CONNECTORS.has(tok.toLowerCase()) || COUPON_STOP.has(tok.toUpperCase())) continue
      const isCode = /^[A-Z][A-Z0-9]{3,19}$/.test(tok) && (/\d/.test(tok) || tok.length >= 5)
      if (isCode) out.add(tok)
      break
    }
  }
  // Fora do "cupom": formato típico de código (letras + número, ex.: "MAIS VENDIDOS DO NIKE40")
  for (const m of text.replace(URL_RE, ' ').matchAll(/(?<![\p{L}\p{N}/.])([A-Z]{3,12}\d{1,3})(?![\p{L}\p{N}])/gu)) out.add(m[1])
  return [...out]
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Formatação do WhatsApp → HTML do Telegram (*negrito*, _itálico_, ~riscado~)
function waToTelegramHtml(text: string) {
  return escapeHtml(text)
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:]|$)/gm, '$1<b>$2</b>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:]|$)/gm, '$1<i>$2</i>')
    .replace(/(^|[\s(])~([^~\n]+)~(?=[\s).,!?:]|$)/gm, '$1<s>$2</s>')
}

export interface ConvertedLink { original: string; store: string | null; affiliateUrl: string | null; code: string | null; short: string | null }
export interface Converted { links: ConvertedLink[]; coupons: string[]; whatsapp: string; telegram: string }

export async function convertSourceText(text: string): Promise<Converted> {
  // Convites de outros grupos/canais não vão para o nosso post
  const body = text
    .split('\n')
    .filter(l => !/chat\.whatsapp\.com|wa\.me\/|whatsapp\.com\/channel|t\.me\//i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const originals = [...new Set(body.match(URL_RE) || [])]
  const links: ConvertedLink[] = []
  for (const original of originals) {
    const target = cleanUrl(await unshorten(original))
    const advertiser = findAwinAdvertiser(target)
    if (!advertiser) {
      links.push({ original, store: null, affiliateUrl: null, code: null, short: null })
      continue
    }
    const affiliateUrl = new AwinProvider(advertiser).buildAffiliateLink(target)
    const code = await linkCode(affiliateUrl, target, advertiser.name)
    links.push({ original, store: advertiser.label, affiliateUrl, code, short: shortLink(code) })
  }

  const withLinks = (src: ClickSrc) => {
    let out = body
    for (const l of links) if (l.code) out = out.split(l.original).join(shortLink(l.code, src))
    return out
  }
  const telegram = links.reduce(
    (html, l) => l.code ? html.split(escapeHtml(l.original)).join(shortLink(l.code, 't')) : html,
    waToTelegramHtml(body),
  )
  return { links, coupons: findCoupons(body), whatsapp: withLinks('a'), telegram }
}
