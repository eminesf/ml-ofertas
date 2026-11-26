import { NextResponse } from 'next/server'
import { getChannels } from '@/lib/api'
import { SITE_URL } from '@/lib/site'

// /entrar/tech?o=lp-tech → conta o clique (tabela Click, provider 'grupo', src = origem) e manda
// para o convite do grupo no WhatsApp. Usado pelos botões das landing pages e da /links.
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const origin = new URL(request.url).searchParams.get('o') || ''
  const { whatsappGroups, whatsapp } = await getChannels()
  const invite = whatsappGroups.find(g => g.key === group)?.url || (group === 'tech' ? whatsapp : null)
  if (!invite) return NextResponse.redirect(`${SITE_URL}/links`, 302)

  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  await fetch(`${api}/api/channels/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, origin, ua: request.headers.get('user-agent') || '' }),
    signal: AbortSignal.timeout(1500),
    cache: 'no-store',
  }).catch(() => {})

  return NextResponse.redirect(invite, 302)
}
