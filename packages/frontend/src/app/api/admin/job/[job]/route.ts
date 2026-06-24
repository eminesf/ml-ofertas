import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const VALID_JOBS = ['offers', 'hub', 'post', 'repost']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job: string }> }
) {
  const { job } = await params
  if (!VALID_JOBS.includes(job)) {
    return NextResponse.json({ error: 'Job inválido' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET

  if (!secret || !token || token !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const { searchParams } = new URL(request.url)
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''

  try {
    const res = await fetch(`${backendUrl}/api/admin/job/${job}${qs}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}
