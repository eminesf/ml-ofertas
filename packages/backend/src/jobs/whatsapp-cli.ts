import '../env'
import { connectWhatsApp, isWhatsAppConnected, listWhatsAppGroups } from '../channels/whatsapp'

// Pareia o número por QR e lista os grupos para preencher WHATSAPP_GROUP_JID.
// Não envia nenhuma mensagem. Rodar com o backend parado (pm2 stop ml-ofertas-backend).

const LOGIN_TIMEOUT_MS = 3 * 60 * 1000
const CREDS_FLUSH_MS = 3000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  await connectWhatsApp({ pair: true, printQr: true })

  const deadline = Date.now() + LOGIN_TIMEOUT_MS
  while (!isWhatsAppConnected()) {
    if (Date.now() > deadline) throw new Error('Tempo esgotado aguardando o pareamento')
    await sleep(500)
  }

  const groups = await listWhatsAppGroups()
  console.log(`\n${groups.length} grupo(s) deste número:`)
  for (const g of groups) console.log(`  ${g.id}  ${g.subject} (${g.participants} participantes)`)
  console.log('\nNo .env: WHATSAPP_GROUP_JID=<id do grupo> e WHATSAPP_ENABLED=true')

  await sleep(CREDS_FLUSH_MS)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
