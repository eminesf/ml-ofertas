import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Proxy do painel de análise → backend /api/admin/analytics
export async function GET(request: Request) {
  const secret = process.env.ADMIN_SECRET
  const cookieStore = await cookies()
  if (!secret || !(await isValidAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const days = new URL(request.url).searchParams.get('days') || '7'
  try {
    const res = await fetch(`${backendUrl}/api/admin/analytics?days=${encodeURIComponent(days)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}
