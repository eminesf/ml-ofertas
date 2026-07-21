import '../env'
import cron from 'node-cron'
import { runRepostJob, runPostingJob } from './offers.job'

// O scheduler roda no Railway e agenda APENAS posting e repost.
// Scraping (ML ofertas, hub, Amazon) é 100% local e manual — ver scrape-cli.ts.
// Motivo: scraping no Railway pesava o container e sofria bloqueios/CAPTCHA
// de IP de datacenter, além de bugs de sessão/autorização no hub ML.

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

  console.log(`[Scheduler] Jobs: posting (a cada 20min, máx ${maxPostsPerRun}), repost (12h/20h). Scraping é manual/local (npm run scrape).`)
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
