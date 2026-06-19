import '../env'
import cron from 'node-cron'
import { MercadoLivreProvider } from '../providers/mercadolivre'
import { runOffersJob, runHubJob, runRepostJob, runPostingJob } from './offers.job'

const providers = [
  new MercadoLivreProvider(),
]

export function startScheduler() {
  console.log('[Scheduler] Iniciando...')

  // Job 1 — Scrape ofertas públicas — 1x/dia às 6h
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Scrape de ofertas públicas...')
    for (const provider of providers) {
      await runOffersJob(provider).catch(console.error)
    }
  })

  // Job 2 — Scrape hub de afiliados + cupons — 1x/dia às 7h (após ofertas)
  cron.schedule('0 7 * * *', async () => {
    console.log('[Scheduler] Scrape do hub de afiliados...')
    await runHubJob(providers).catch(console.error)
  })

  // Job 3 — Posting cadenciado — a cada 20 min, posta até ML_POST_MAX ofertas pendentes
  const maxPostsPerRun = parseInt(process.env.ML_POST_MAX || '3', 10)
  cron.schedule('*/20 * * * *', async () => {
    console.log('[Scheduler] Posting de ofertas pendentes...')
    await runPostingJob(maxPostsPerRun).catch(console.error)
  })

  // Job 4 — Repost de ofertas válidas — às 12h e 20h
  cron.schedule('0 12,20 * * *', async () => {
    console.log('[Scheduler] Repost de ofertas...')
    await runRepostJob().catch(console.error)
  })

  console.log('[Scheduler] Jobs: scrape ofertas (6h), scrape hub (7h), posting (a cada 20min, máx 3), repost (12h/20h)')
}

// Permite rodar manualmente: npx tsx src/jobs/scheduler.ts --now [--hub|--repost|--post]
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--now')) {
    console.log('[Scheduler] Rodando manualmente...')
    const job = args.includes('--hub')
      ? runHubJob(providers)
      : args.includes('--repost')
        ? runRepostJob()
        : args.includes('--post')
          ? runPostingJob(5)
          : runOffersJob(providers[0])

    job.then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
  }
}
