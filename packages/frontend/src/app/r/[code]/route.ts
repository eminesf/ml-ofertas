import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
// Robôs de prévia de link não contam como clique
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord/i

// Link curto dos posts (Telegram/WhatsApp): /r/{code} → link de afiliado da loja
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const isBot = BOT_UA.test(req.headers.get('user-agent') || '')
  try {
    const res = await fetch(`${API_URL}/api/offers/go/${encodeURIComponent(code)}${isBot ? '?count=0' : ''}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const { url } = (await res.json()) as { url: string }
      if (/^https?:\/\//.test(url)) {
        return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
      }
    }
  } catch {}
  return NextResponse.redirect(new URL('/', req.url), 302)
}
