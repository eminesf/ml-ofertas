import '../env'
import fs from 'fs'
import readline from 'readline'
import { createUserClient, SESSION_FILE } from '../channels/telegram/user-client'

// Login da conta do Telegram para LER grupos privados (TELEGRAM_PRIVATE_SOURCES).
// Uso: npm run telegram:login  — pede telefone, código (e senha de 2 etapas, se tiver).
// Rode num terminal seu; o código chega no app do Telegram.

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string) => new Promise<string>(resolve => rl.question(q, a => resolve(a.trim())))

async function main() {
  const client = createUserClient()
  await client.start({
    phoneNumber: () => ask('Telefone com DDI (ex.: +5551999999999): '),
    phoneCode: () => ask('Código que chegou no Telegram: '),
    password: () => ask('Senha de verificação em 2 etapas (se não tiver, só Enter): '),
    onError: err => console.error('Erro:', err.message),
  })
  fs.writeFileSync(SESSION_FILE, String(client.session.save()), { mode: 0o600 })
  const me: any = await client.getMe()
  console.log(`\n✓ Logado como ${me.firstName || ''} ${me.username ? '@' + me.username : ''}. Sessão salva em ${SESSION_FILE}`)
  await client.disconnect()
  rl.close()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
