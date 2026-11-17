import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ALLOWED: Record<string, string[]> = {
  GET: ['status', 'groups'],
  POST: ['connect'],
}

async function proxy(method: 'GET' | 'POST', params: Promise<{ action: string }>) {
  const { action } = await params
  if (!ALLOWED[method].includes(action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET

  if (!secret || !token || token !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  try {
    const res = await fetch(`${backendUrl}/api/admin/whatsapp/${action}`, {
      method,
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}

type RouteContext = { params: Promise<{ action: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  return proxy('GET', params)
}

export async function POST(_request: Request, { params }: RouteContext) {
  return proxy('POST', params)
}
