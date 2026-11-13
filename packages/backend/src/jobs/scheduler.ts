import '../env'
import cron from 'node-cron'
import { runRepostJob, runPostingJob, runOffersJob, runWhatsAppPostingJob } from './offers.job'
import { connectWhatsApp, isWhatsAppEnabled } from '../channels/whatsapp'
import { AwinProvider, AWIN_ADVERTISERS } from '../providers/awin'

// Agenda posting, repost e os feeds Awin (download HTTP leve, sem browser).
// Scraping com Playwright (ML ofertas, hub, Amazon) continua manual — ver scrape-cli.ts.

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

  if (isWhatsAppEnabled()) {
    connectWhatsApp().catch(err => console.error('[WhatsApp] Falha ao conectar:', err))
    const maxWhatsAppPerRun = parseInt(process.env.WHATSAPP_POST_MAX || '1', 10)
    cron.schedule('5,35 * * * *', async () => {
      await runWhatsAppPostingJob(maxWhatsAppPerRun).catch(console.error)
    })
    console.log(`[Scheduler] WhatsApp: posting a cada 30min (máx ${maxWhatsAppPerRun})`)
  }

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
