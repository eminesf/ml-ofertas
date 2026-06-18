import axios from 'axios'

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendMessage(text: string): Promise<boolean> {
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHANNEL_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
    await sleep(1000)
    return true
  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar mensagem:', error?.response?.data || error.message)
    return false
  }
}

export async function sendPhoto(imageUrl: string, caption: string): Promise<boolean> {
  try {
    await axios.post(`${BASE_URL}/sendPhoto`, {
      chat_id: process.env.TELEGRAM_CHANNEL_ID,
      photo: imageUrl,
      caption,
      parse_mode: 'HTML'
    })
    await sleep(1000)
    return true
  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar foto:', error?.response?.data || error.message)
    // Fallback: tenta como mensagem de texto
    try {
      return await sendMessage(caption)
    } catch {
      return false
    }
  }
}

export async function sendMediaGroup(
  offers: Array<{ imageUrl: string; caption: string }>
): Promise<boolean> {
  if (!offers.length) return false
  try {
    const media = offers.slice(0, 10).map((o, i) => ({
      type: 'photo',
      media: o.imageUrl,
      caption: i === 0 ? o.caption : undefined,
      parse_mode: i === 0 ? 'HTML' : undefined,
    }))

    await axios.post(`${BASE_URL}/sendMediaGroup`, {
      chat_id: process.env.TELEGRAM_CHANNEL_ID,
      media,
    })
    await sleep(1000)
    return true
  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar media group:', error?.response?.data || error.message)
    return false
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
