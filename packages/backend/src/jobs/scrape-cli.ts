import '../env'
import { MercadoLivreProvider } from '../providers/mercadolivre'
import { AmazonProvider } from '../providers/amazon'
import { AwinProvider, AWIN_ADVERTISERS } from '../providers/awin'
import { ShopeeProvider } from '../providers/shopee'
import { runOffersJob, runHubJob } from './offers.job'
import { runTelegramSourceJob } from './telegram-source'

// CLI de scraping 100% LOCAL — grava direto no Postgres do Railway via DATABASE_URL.
// O Railway NÃO roda mais scraping agendado (peso + bloqueios de IP de datacenter);
// apenas posting/repost continuam agendados lá.
//
// Uso: tsx src/jobs/scrape-cli.ts <alvo>
//   ml      → ofertas públicas do Mercado Livre (/ofertas)
//   hub     → hub de afiliados ML + cupons (requer sessão ML)
//   amazon  → ofertas do dia da Amazon (/deals)
//   awin    → product feeds Awin (Kabum, AliExpress, Stanley) — requer AWIN_FEED_API_KEY
//   shopee  → feed de produto diário da Shopee — requer SHOPEE_FEED_URLS
//   telegram → ofertas de canais públicos do Telegram (TELEGRAM_SOURCES), com o nosso link
//   all     → todos acima em sequência
//   --show  → abre o browser visível (SCRAPE_HEADLESS=false) para acompanhar o scraping
//

const TARGETS = ['ml', 'hub', 'amazon', 'awin', 'shopee', 'telegram', 'all'] as const
type Target = (typeof TARGETS)[number]

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--show')) process.env.SCRAPE_HEADLESS = 'false'
  const target = (args.find(a => !a.startsWith('--')) || 'all') as Target
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

  if (target === 'awin' || target === 'all') {
    for (const advertiser of AWIN_ADVERTISERS) {
      await runOffersJob(new AwinProvider(advertiser)).catch(err => console.error(`[ScrapeCLI] awin:${advertiser.name} falhou:`, err))
    }
  }

  if (target === 'shopee' || target === 'all') {
    await runOffersJob(new ShopeeProvider()).catch(err => console.error('[ScrapeCLI] shopee falhou:', err))
  }

  if (target === 'telegram') {
    await runTelegramSourceJob().catch(err => console.error('[ScrapeCLI] telegram falhou:', err))
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
