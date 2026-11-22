import { chromium, Browser, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// Navegador do ML compartilhado por scrape de ofertas, import de produto e hub:
// todos usam a MESMA sessão salva (.ml-session.json). Quando o ML pede
// verificação/captcha, você resolve uma vez no PC com `npm run ml:login`
// e os scrapes automáticos voltam a passar enquanto a sessão durar.

export const ML_SESSION_PATH = path.resolve(__dirname, '../../../../.ml-session.json')
const NOTICE_PATH = path.resolve(__dirname, '../../../../.ml-blocked-notice')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export async function newMlContext(headless = process.env.SCRAPE_HEADLESS !== 'false'): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    ...(fs.existsSync(ML_SESSION_PATH) ? { storageState: ML_SESSION_PATH } : {}),
  })
  await context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: function() { return false } })')
  return { browser, context }
}

// Guarda cookies renovados depois de uma navegação bem-sucedida (sessão dura mais)
export async function saveMlSession(context: BrowserContext): Promise<void> {
  try { await context.storageState({ path: ML_SESSION_PATH }) } catch {}
}

export function isMlBlockedUrl(url: string): boolean {
  return /account-verification|captcha|suspicious-traffic|\/gz\/|web-risk/i.test(url)
}

let lastBlockedAt = 0
export function mlRecentlyBlocked(): boolean {
  return Date.now() - lastBlockedAt < 30 * 60_000
}

// Avisa no WhatsApp do dono (no máx. 1x a cada 12h) que precisa resolver o captcha no PC
export async function reportMlBlocked(where: string): Promise<void> {
  lastBlockedAt = Date.now()
  console.warn(`[ML] Bloqueado pelo ML (${where}) — rode "npm run ml:login" no PC e resolva a verificação`)
  try {
    const last = fs.existsSync(NOTICE_PATH) ? Number(fs.readFileSync(NOTICE_PATH, 'utf8')) : 0
    if (Date.now() - last < 12 * 3600_000) return
    const secret = process.env.ADMIN_SECRET
    if (!secret) return
    const res = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/api/admin/whatsapp/notify-self`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        text: `🦊 Fox Promoções: o Mercado Livre pediu verificação (${where}).\n\nQuando estiver no PC, rode:\nnpm run ml:login\n\nResolva o captcha/login na janela do Chromium. Até lá, scrape e import do ML ficam parados (Amazon, Shopee, KaBuM e canais do Telegram seguem normais).`,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) fs.writeFileSync(NOTICE_PATH, String(Date.now()))
  } catch {}
}
