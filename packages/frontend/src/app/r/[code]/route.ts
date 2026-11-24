import { NextRequest, NextResponse, after } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
// Robôs de prévia de link não contam como clique
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord/i

// O link de afiliado de um código não muda: guarda em memória (instância quente)
// para o clique não esperar a ida até a API no PC. O clique é contado depois do
// redirect (after), sem atrasar quem clicou.
const CACHE_TTL_MS = 60 * 60_000
const cache = new Map<string, { url: string; at: number }>()

function redirect(url: string) {
  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}

// Link curto dos posts (Telegram/WhatsApp): /r/{code} → link de afiliado da loja
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const isBot = BOT_UA.test(req.headers.get('user-agent') || '')
  const goUrl = `${API_URL}/api/offers/go/${encodeURIComponent(code)}`

  const hit = cache.get(code)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    if (!isBot) after(() => fetch(goUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) }).catch(() => {}))
    return redirect(hit.url)
  }

  try {
    const res = await fetch(`${goUrl}${isBot ? '?count=0' : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const { url } = (await res.json()) as { url: string }
      if (/^https?:\/\//.test(url)) {
        if (cache.size > 2000) cache.clear()
        cache.set(code, { url, at: Date.now() })
        return redirect(url)
      }
    }
  } catch {}
  return NextResponse.redirect(new URL('/', req.url), 302)
}
