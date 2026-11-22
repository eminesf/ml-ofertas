import '../env'
import * as fs from 'fs'
import { newMlContext, saveMlSession, isMlBlockedUrl, ML_SESSION_PATH } from '../providers/mercadolivre/browser'

// Renova a sessão do Mercado Livre: abre o Chromium VISÍVEL, você resolve o
// captcha/verificação e faz login se pedir; a sessão é salva e passa a ser usada
// pelo scrape de ofertas, import de produto e hub.  Uso: npm run ml:login

const LIMITE_MS = 10 * 60_000

async function esperar(cond: () => Promise<boolean>, ms: number): Promise<boolean> {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    if (await cond().catch(() => false)) return true
    await new Promise(r => setTimeout(r, 2000))
  }
  return false
}

async function main() {
  const { browser, context } = await newMlContext(false)
  const page = await context.newPage()
  try {
    console.log('\n[ML Login] Abrindo o Mercado Livre... resolva o captcha/verificação na janela se aparecer (até 10 min).')
    await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const ofertasOk = await esperar(async () => !isMlBlockedUrl(page.url()) && (await page.$('.poly-card')) !== null, LIMITE_MS)
    if (!ofertasOk) throw new Error('A página de ofertas não carregou a tempo (verificação não concluída)')
    console.log('[ML Login] ✓ Ofertas liberadas')

    console.log('[ML Login] Abrindo o hub de afiliados... faça login se pedir.')
    await page.goto('https://www.mercadolivre.com.br/afiliados/hub', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const hubOk = await esperar(async () => page.url().includes('/afiliados/hub') && !isMlBlockedUrl(page.url()), LIMITE_MS)
    console.log(hubOk ? '[ML Login] ✓ Logado no hub de afiliados' : '[ML Login] ⚠ Hub não confirmou login (ofertas e import seguem funcionando)')

    await saveMlSession(context)
    fs.rmSync(ML_SESSION_PATH.replace('.ml-session.json', '.ml-blocked-notice'), { force: true })
    console.log(`[ML Login] Sessão salva em ${ML_SESSION_PATH}. Pode fechar.\n`)
  } finally {
    await browser.close()
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('[ML Login] Erro:', err.message); process.exit(1) })
