import fs from 'fs'
import path from 'path'
import { TelegramClient, Api } from 'telegram'
import { StringSession } from 'telegram/sessions'

// Leitura de grupos/canais PRIVADOS do Telegram pela conta do dono (MTProto).
// Só lê — nunca envia nada por essa conta. Credenciais de my.telegram.org no .env
// (TELEGRAM_API_ID / TELEGRAM_API_HASH); sessão em packages/.telegram-user-session
// (gitignored, equivale a estar logado — não compartilhar).

export const SESSION_FILE = path.join(__dirname, '..', '..', '..', '..', '.telegram-user-session')

export function userClientConfigured(): boolean {
  return !!process.env.TELEGRAM_API_ID && !!process.env.TELEGRAM_API_HASH && fs.existsSync(SESSION_FILE)
}

export function createUserClient(session = ''): TelegramClient {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || '', 10)
  const apiHash = process.env.TELEGRAM_API_HASH || ''
  if (!apiId || !apiHash) throw new Error('TELEGRAM_API_ID / TELEGRAM_API_HASH não configurados no .env')
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 })
  client.setLogLevel('error' as any)
  return client
}

export interface PrivatePost { id: number; text: string; links: string[] }

// Lê as últimas mensagens de um grupo privado pelo hash do convite (t.me/+HASH).
// A conta precisa já ser membro do grupo.
export async function fetchPrivatePosts(inviteHash: string, limit = 30): Promise<{ title: string; posts: PrivatePost[] }> {
  const client = createUserClient(fs.readFileSync(SESSION_FILE, 'utf8').trim())
  await client.connect()
  try {
    const invite = await client.invoke(new Api.messages.CheckChatInvite({ hash: inviteHash.replace(/^\+/, '') }))
    if (!(invite instanceof Api.ChatInviteAlready)) throw new Error('a conta não é membro desse grupo — entre pelo link primeiro')
    const chat = invite.chat as any
    const messages = await client.getMessages(chat, { limit })
    const posts: PrivatePost[] = messages
      .filter(m => m && typeof m.message === 'string' && m.message.length > 0)
      .map(m => {
        const text = m.message
        const links: string[] = []
        for (const e of m.entities || []) {
          if (e instanceof Api.MessageEntityTextUrl) links.push(e.url)
          else if (e instanceof Api.MessageEntityUrl) links.push(text.substr(e.offset, e.length))
        }
        // botões com link ("Comprar")
        const rows = (m.replyMarkup as any)?.rows || []
        for (const row of rows) for (const b of row.buttons || []) if (b.url) links.push(b.url)
        const clean = links
          .map(u => (/^https?:\/\//.test(u) ? u : `https://${u}`))
          .filter(u => !/t\.me\/|telegram\.(org|me)/.test(u))
        return { id: m.id, text, links: [...new Set(clean)] }
      })
      .sort((a, b) => a.id - b.id)
    return { title: chat.title || inviteHash, posts }
  } finally {
    await client.disconnect().catch(() => {})
  }
}
