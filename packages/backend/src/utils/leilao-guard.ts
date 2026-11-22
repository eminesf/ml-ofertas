import fs from 'fs'

// O bot-leilao roda no mesmo PC. Durante um leilão nada pesado (Playwright)
// pode rodar. Lê o SQLite do bot em modo SOMENTE LEITURA e diz se há leilão
// ativo ou agendado para começar em breve. Banco ausente/ilegível → libera.

const DB_PATH = process.env.BOT_LEILAO_DB || 'C:/dev/bot-leilao/data/leilao.db'
const MARGEM_MIN = parseInt(process.env.BOT_LEILAO_MARGEM_MIN || '90', 10)

export function leilaoEmAndamentoOuProximo(): string | null {
  if (!fs.existsSync(DB_PATH)) return null
  try {
    // require: node:sqlite é nativo do Node >= 22.5 e não está nos @types/node 22
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(DB_PATH, { readOnly: true })
    try {
      const ativo = db
        .prepare("SELECT id FROM auction_sessions WHERE status = 'ativo' AND encerrado_em IS NULL LIMIT 1")
        .get()
      if (ativo) return `leilão #${ativo.id} ativo`

      const agora = new Date()
      const limite = new Date(agora.getTime() + MARGEM_MIN * 60_000)
      const proximo = db
        .prepare(
          `SELECT id, agendado_para FROM auction_sessions
           WHERE status = 'agendado' AND agendado_para IS NOT NULL
             AND agendado_para <= ? ORDER BY agendado_para LIMIT 1`,
        )
        .get(limite.toISOString())
      if (proximo) return `leilão #${proximo.id} agendado para ${proximo.agendado_para}`
      return null
    } finally {
      db.close()
    }
  } catch (err) {
    console.warn('[LeilaoGuard] Não consegui ler o banco do bot-leilao:', (err as Error).message)
    return null
  }
}
