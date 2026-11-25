import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/repost/status e POST /api/admin/repost/cancel → backend /api/admin/job/repost/*
async function proxy(method: 'GET' | 'POST', action: string) {
  if (!['status', 'cancel'].includes(action)) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  if (method === 'POST' && action !== 'cancel') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  const secret = process.env.ADMIN_SECRET
  const cookieStore = await cookies()
  if (!secret || !(await isValidAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  try {
    const res = await fetch(`${backendUrl}/api/admin/job/repost/${action}`, {
      method,
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ action: string }> }) {
  return proxy('GET', (await params).action)
}

export async function POST(_req: Request, { params }: { params: Promise<{ action: string }> }) {
  return proxy('POST', (await params).action)
}
