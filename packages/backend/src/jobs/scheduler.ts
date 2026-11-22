import '../env'
import cron from 'node-cron'
import { runRepostJob, runPostingJob, runOffersJob, runWhatsAppPostingJob } from './offers.job'
import { connectWhatsApp, isWhatsAppEnabled } from '../channels/whatsapp'
import { AwinProvider, AWIN_ADVERTISERS } from '../providers/awin'
import { ShopeeProvider } from '../providers/shopee'
import { spawn } from 'child_process'
import path from 'path'
import { leilaoEmAndamentoOuProximo } from '../utils/leilao-guard'

let scrapeRodando = false

// Scrapes com Playwright rodam em processo filho (scrape-cli) para um vazamento
// ou crash do Chromium não derrubar a API. Pula se o bot-leilao estiver em leilão.
function runScrapeCli(target: string): Promise<void> {
  const bloqueio = leilaoEmAndamentoOuProximo()
  if (bloqueio) {
    console.log(`[Scheduler] Scrape ${target} pulado: ${bloqueio}`)
    return Promise.resolve()
  }
  if (scrapeRodando) {
    console.log(`[Scheduler] Scrape ${target} pulado: outro scrape ainda rodando`)
    return Promise.resolve()
  }
  scrapeRodando = true
  const script = path.join(__dirname, 'scrape-cli' + path.extname(__filename))
  console.log(`[Scheduler] Scrape ${target} iniciado...`)
  return new Promise(resolve => {
    const child = spawn(process.execPath, [...process.execArgv, script, target], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, SCRAPE_HEADLESS: 'true' },
      stdio: 'inherit',
      windowsHide: true,
    })
    // trava de segurança: 30 min
    const timer = setTimeout(() => { console.warn(`[Scheduler] Scrape ${target} passou de 30 min — encerrando`); child.kill() }, 30 * 60_000)
    child.on('exit', code => {
      clearTimeout(timer)
      scrapeRodando = false
      console.log(`[Scheduler] Scrape ${target} terminou (exit ${code})`)
      resolve()
    })
    child.on('error', err => {
      clearTimeout(timer)
      scrapeRodando = false
      console.error(`[Scheduler] Scrape ${target} falhou ao iniciar:`, err)
      resolve()
    })
  })
}

// Agenda posting, repost e os feeds Awin e Shopee (download HTTP, sem browser).
// ML /ofertas e Amazon /deals (Playwright) rodam em 9h30 e 15h30, longe do horário
// dos leilões (~18h30–22h30), e são pulados se houver leilão ativo/próximo.
// Hub ML continua manual (pode exigir login interativo).

export function startScheduler() {
  console.log('[Scheduler] Iniciando...')

  // Posting cadenciado — a cada 20 min, posta até ML_POST_MAX ofertas pendentes
  const maxPostsPerRun = parseInt(process.env.ML_POST_MAX || '3', 10)
  cron.schedule('*/20 * * * *', async () => {
    console.log('[Scheduler] Posting de ofertas pendentes...')
    await runPostingJob(maxPostsPerRun).catch(console.error)
  })

  // Repost de ofertas válidas — às 12h e 20h
  cron.schedule('0 12,20 * * *', async () => {
    console.log('[Scheduler] Repost de ofertas...')
    await runRepostJob().catch(console.error)
  })

  // Feeds Awin 3x/dia — cada rodada também atualiza a base de preços usada na queda de preço da Kabum
  if (process.env.AWIN_FEED_API_KEY) {
    cron.schedule('15 6,12,18 * * *', async () => {
      console.log('[Scheduler] Feeds Awin...')
      for (const advertiser of AWIN_ADVERTISERS.filter(a => a.feedIds?.length)) {
        await runOffersJob(new AwinProvider(advertiser)).catch(console.error)
      }
    })
    console.log('[Scheduler] Feeds Awin: 6h15, 12h15 e 18h15')
  }

  // Feed Shopee: o portal atualiza 1x/dia (por volta das 20h). Rodar 2x pega
  // a virada do dia; produto com preço igual ao já salvo é pulado sem IA.
  if (process.env.SHOPEE_FEED_URLS) {
    cron.schedule('40 7,21 * * *', async () => {
      console.log('[Scheduler] Feed Shopee...')
      await runOffersJob(new ShopeeProvider()).catch(console.error)
    })
    console.log('[Scheduler] Feed Shopee: 7h40 e 21h40')
  }

  if (process.env.SCRAPE_SCHEDULE_DISABLED !== 'true') {
    cron.schedule('30 9,15 * * *', async () => {
      await runScrapeCli('ml')
      await runScrapeCli('amazon')
    })
    console.log('[Scheduler] Scrape ML + Amazon: 9h30 e 15h30 (pula durante leilão)')
  }

  if (isWhatsAppEnabled()) {
    connectWhatsApp().catch(err => console.error('[WhatsApp] Falha ao conectar:', err))
    const maxWhatsAppPerRun = parseInt(process.env.WHATSAPP_POST_MAX || '1', 10)
    cron.schedule('5,35 * * * *', async () => {
      await runWhatsAppPostingJob(maxWhatsAppPerRun).catch(console.error)
    })
    console.log(`[Scheduler] WhatsApp: posting a cada 30min (máx ${maxWhatsAppPerRun})`)
  }

  console.log(`[Scheduler] Jobs: posting (a cada 20min, máx ${maxPostsPerRun}), repost (12h/20h). Hub ML é manual (npm run scrape:hub).`)
}

// Rodar posting/repost manualmente: npx tsx src/jobs/scheduler.ts --now [--post|--repost]
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--now')) {
    console.log('[Scheduler] Rodando manualmente...')
    const job = args.includes('--repost') ? runRepostJob() : runPostingJob(5)
    job.then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
  }
}
