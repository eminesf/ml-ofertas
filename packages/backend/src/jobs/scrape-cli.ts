import '../env'
import { MercadoLivreProvider } from '../providers/mercadolivre'
import { AmazonProvider } from '../providers/amazon'
import { runOffersJob, runHubJob } from './offers.job'

// CLI de scraping 100% LOCAL — grava direto no Postgres do Railway via DATABASE_URL.
// O Railway NÃO roda mais scraping agendado (peso + bloqueios de IP de datacenter);
// apenas posting/repost continuam agendados lá.
//
// Uso: tsx src/jobs/scrape-cli.ts <alvo>
//   ml      → ofertas públicas do Mercado Livre (/ofertas)
//   hub     → hub de afiliados ML + cupons (requer sessão ML)
//   amazon  → ofertas do dia da Amazon (/deals)
//   all     → todos acima em sequência
//
// Shopee e Awin (Kabum/AliExpress/Stanley) não têm scraping de listagem —
// produtos dessas plataformas entram via import por URL no painel admin.

const TARGETS = ['ml', 'hub', 'amazon', 'all'] as const
type Target = (typeof TARGETS)[number]

async function main() {
  const target = (process.argv[2] || 'all') as Target
  if (!TARGETS.includes(target)) {
    console.error(`Alvo inválido: "${target}". Use: ${TARGETS.join(' | ')}`)
    process.exit(1)
  }

  console.log(`[ScrapeCLI] Alvo: ${target} | banco: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@')}`)

  if (target === 'ml' || target === 'all') {
    await runOffersJob(new MercadoLivreProvider()).catch(err => console.error('[ScrapeCLI] ml falhou:', err))
  }

  if (target === 'amazon' || target === 'all') {
    await runOffersJob(new AmazonProvider()).catch(err => console.error('[ScrapeCLI] amazon falhou:', err))
  }

  if (target === 'hub' || target === 'all') {
    await runHubJob([new MercadoLivreProvider()]).catch(err => console.error('[ScrapeCLI] hub falhou:', err))
  }

  console.log('[ScrapeCLI] Concluído')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
