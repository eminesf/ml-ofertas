import fs from 'fs'
import path from 'path'
import type { WASocket } from '@whiskeysockets/baileys'

// Canal WhatsApp via Baileys (mesma versão do bot-leilao). O envio fica desligado por padrão:
// só posta com WHATSAPP_ENABLED=true e WHATSAPP_GROUP_JID=<id>@g.us no .env.
// Parear: botão "Conectar WhatsApp" em /admin (QR em modal) ou npm run whatsapp:login
// com o backend parado — uma sessão só pode ter um socket.
//
// O pacote é ESM e é carregado sob demanda: requer Node >= 22.12 (require de ESM)
// e, se falhar, não derruba o backend nem o posting do Telegram.

const AUTH_DIR = path.resolve(__dirname, '../../../../.wa-session')
const RECONNECT_DELAY_MS = 5000

const STATUS_LOGGED_OUT = 401
const STATUS_CONNECTION_REPLACED = 440

const silentLogger: any = {
  level: 'silent',
  child: () => silentLogger,
  trace() {}, debug() {}, info() {}, warn() {}, error() {},
}

interface ConnectOptions {
  pair?: boolean     // permite gerar QR quando não há sessão pareada
  printQr?: boolean  // desenha o QR no terminal (CLI)
}

let sock: WASocket | null = null
let isOpen = false
let connecting = false
let latestQr: string | null = null
let reconnectTimer: NodeJS.Timeout | null = null

export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === 'true' && !!process.env.WHATSAPP_GROUP_JID?.endsWith('@g.us')
}

export function isWhatsAppConnected(): boolean {
  return isOpen
}

export function getWhatsAppStatus(): { conectado: boolean; conectando: boolean; qr: string | null } {
  return { conectado: isOpen, conectando: connecting || reconnectTimer !== null, qr: latestQr }
}

// Idempotente: duas chamadas simultâneas abririam dois sockets na mesma sessão (erro 440)
export async function connectWhatsApp(options: ConnectOptions = {}): Promise<void> {
  if (isOpen || connecting || reconnectTimer) return
  connecting = true
  try {
    await openSocket(options)
  } catch (err) {
    connecting = false
    throw err
  }
}

async function openSocket(options: ConnectOptions): Promise<void> {
  const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys')
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  // Sem sessão pareada o backend não fica gerando QR sem ninguém olhando
  if (!state.creds.me && !options.pair) {
    connecting = false
    console.warn('[WhatsApp] Sessão não pareada — conecte pelo painel /admin')
    return
  }

  const { version } = await fetchLatestBaileysVersion()
  const socket = makeWASocket({
    version,
    auth: state,
    logger: silentLogger,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  sock = socket
  isOpen = false

  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      latestQr = qr
      if (options.printQr) {
        console.log('\nEscaneie no WhatsApp (Aparelhos conectados):\n')
        require('qrcode-terminal').generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      isOpen = true
      connecting = false
      latestQr = null
      console.log('[WhatsApp] Conectado')
    }

    if (connection === 'close') {
      isOpen = false
      connecting = false
      latestQr = null
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode

      if (statusCode === STATUS_LOGGED_OUT) {
        // Sessão invalidada não volta a funcionar; sem ela o próximo connect gera QR novo
        fs.rmSync(AUTH_DIR, { recursive: true, force: true })
        console.error('[WhatsApp] Sessão deslogada — conecte de novo pelo painel /admin')
        return
      }
      // Reconectar aqui faria dois processos derrubarem um ao outro em loop
      if (statusCode === STATUS_CONNECTION_REPLACED) {
        console.error('[WhatsApp] Sessão aberta em outro processo — esta conexão foi encerrada')
        return
      }
      // Ninguém escaneou: para aqui em vez de gerar QR para sempre
      if (!state.creds.me) {
        console.log('[WhatsApp] QR expirou sem pareamento')
        return
      }

      console.warn(`[WhatsApp] Conexão fechada (status ${statusCode}), reconectando...`)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectWhatsApp(options).catch(err => console.error('[WhatsApp] Falha ao reconectar:', err))
      }, RECONNECT_DELAY_MS)
    }
  })
}

export async function listWhatsAppGroups(): Promise<{ id: string; subject: string; participants: number }[]> {
  if (!sock || !isOpen) throw new Error('WhatsApp não conectado')
  const groups = await sock.groupFetchAllParticipating()
  return Object.values(groups).map(g => ({ id: g.id, subject: g.subject, participants: g.participants.length }))
}

// Envia foto com legenda; se a imagem falhar, envia só o texto
export async function sendWhatsAppPost(text: string, imageUrl?: string | null): Promise<boolean> {
  const jid = process.env.WHATSAPP_GROUP_JID
  if (!sock || !isOpen || !jid?.endsWith('@g.us')) return false

  if (imageUrl) {
    try {
      await sock.sendMessage(jid, { image: { url: imageUrl }, caption: text })
      return true
    } catch (err: any) {
      console.warn('[WhatsApp] Erro ao enviar imagem, tentando só texto:', err?.message)
    }
  }

  try {
    await sock.sendMessage(jid, { text })
    return true
  } catch (err: any) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', err?.message)
    return false
  }
}

// Mensagem para o próprio número pareado ("Você" no WhatsApp) — avisos para o dono do bot
export async function sendWhatsAppToSelf(text: string): Promise<boolean> {
  const self = sock?.user?.id
  if (!sock || !self) return false
  const jid = self.split(':')[0].split('@')[0] + '@s.whatsapp.net'
  await sock.sendMessage(jid, { text })
  return true
}
