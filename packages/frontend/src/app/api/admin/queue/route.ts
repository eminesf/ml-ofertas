import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Proxy para o backend: ofertas aprovadas que ainda não foram para os grupos
export async function GET(request: Request) {
  const secret = process.env.ADMIN_SECRET
  const cookieStore = await cookies()
  if (!secret || !(await isValidAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const hours = new URL(request.url).searchParams.get('hours') || '48'
  try {
    const res = await fetch(`${backendUrl}/api/admin/queue?hours=${encodeURIComponent(hours)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}
