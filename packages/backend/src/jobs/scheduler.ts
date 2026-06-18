import '../env'
import cron from 'node-cron'
import { MercadoLivreProvider } from '../providers/mercadolivre'
import { runOffersJob, runHubJob, runRepostJob } from './offers.job'

const providers = [
  new MercadoLivreProvider(),
]

export function startScheduler() {
  console.log('[Scheduler] Iniciando...')

  // Job 1 — Ofertas públicas (/ofertas) — a cada 3h
  cron.schedule('0 */3 * * *', async () => {
    console.log('[Scheduler] Job de ofertas públicas...')
    for (const provider of providers) {
      await runOffersJob(provider).catch(console.error)
    }
  })

  // Job 2 — Hub de afiliados + cupons (requer login) — às 8h e 18h
  cron.schedule('0 8,18 * * *', async () => {
    console.log('[Scheduler] Job do hub de afiliados...')
    await runHubJob(providers).catch(console.error)
  })

  // Job 3 — Repost de ofertas válidas — a cada 6h
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Job de repost...')
    await runRepostJob().catch(console.error)
  })

  console.log('[Scheduler] Jobs agendados: ofertas (3h), hub (8h/18h), repost (6h)')
}

// Permite rodar manualmente: npx tsx src/jobs/scheduler.ts --now
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--now')) {
    console.log('[Scheduler] Rodando manualmente...')
    const job = args.includes('--hub')
      ? runHubJob(providers)
      : args.includes('--repost')
        ? runRepostJob()
        : runOffersJob(providers[0])

    job.then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
  }
}
