import { chromium, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const SESSION_PATH = path.resolve(__dirname, '../../../../.ml-session.json')

async function createBrowserBase() {
  return chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ]
  })
}

async function isSessionValid(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage()
  try {
    await page.goto('https://www.mercadolivre.com.br/afiliados/hub', {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    const url = page.url()
    return url.includes('/afiliados/hub')
  } catch {
    return false
  } finally {
    await page.close()
  }
}

async function doLogin(context: BrowserContext): Promise<void> {
  const email = process.env.ML_EMAIL
  const password = process.env.ML_PASSWORD
  if (!email || !password) throw new Error('ML_EMAIL e ML_PASSWORD são obrigatórios')

  const page = await context.newPage()
  try {
    await page.goto('https://www.mercadolivre.com.br/', {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    const loginBtn = await page.waitForSelector('a[href*="login"], a[href*="entrar"], .nav-header-user-items a', { timeout: 10000 })
    await loginBtn.click()

    await page.waitForSelector('#user_id, input[name="user_id"], input[type="email"]', { timeout: 15000 })
    await page.fill('#user_id, input[name="user_id"], input[type="email"]', email)
    await page.click('button[type="submit"], .login-button')

    await page.waitForSelector('#password, input[name="password"], input[type="password"]', { timeout: 15000 })
    await page.fill('#password, input[name="password"], input[type="password"]', password)
    await page.click('button[type="submit"], .login-button')

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 })
    console.log('[Auth] Login realizado. URL atual:', page.url())

    // 2FA — aguarda se precisar de interação manual (até 60s)
    const url = page.url()
    if (url.includes('challenge') || url.includes('verify')) {
      console.log('[Auth] 2FA detectado. Aguardando resolução manual (60s)...')
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 })
    }

    await context.storageState({ path: SESSION_PATH })
    console.log('[Auth] Sessão salva em', SESSION_PATH)
  } finally {
    await page.close()
  }
}

export async function getAuthenticatedContext(): Promise<BrowserContext> {
  const browser = await createBrowserBase()

  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 } as const,
    locale: 'pt-BR',
  }

  // Tenta reutilizar sessão salva
  if (fs.existsSync(SESSION_PATH)) {
    console.log('[Auth] Sessão encontrada, verificando validade...')
    const context = await browser.newContext({ ...contextOptions, storageState: SESSION_PATH })
    await context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: function() { return false } })')

    if (await isSessionValid(context)) {
      console.log('[Auth] Sessão válida, reutilizando')
      return context
    }

    console.log('[Auth] Sessão expirada, fazendo novo login')
    await context.close()
  } else {
    console.log('[Auth] Nenhuma sessão salva, fazendo login')
  }

  const context = await browser.newContext(contextOptions)
  await context.addInitScript('Object.defineProperty(navigator, "webdriver", { get: function() { return false } })')

  await doLogin(context)
  return context
}

// Teste manual: npx tsx src/providers/mercadolivre/auth.ts
if (require.main === module) {
  ;(async () => {
    require('dotenv/config')
    const ctx = await getAuthenticatedContext()
    console.log('[Auth] Contexto autenticado obtido com sucesso')
    await ctx.browser()?.close()
  })().catch(console.error)
}
