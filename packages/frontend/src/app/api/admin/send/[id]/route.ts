import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'

// O envio no WhatsApp espera 20–40s entre mensagens
export const maxDuration = 90

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const secret = process.env.ADMIN_SECRET
  const cookieStore = await cookies()
  if (!secret || !(await isValidAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!/^[a-z0-9]+$/i.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  try {
    const res = await fetch(`${backendUrl}/api/admin/offer/${id}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}
