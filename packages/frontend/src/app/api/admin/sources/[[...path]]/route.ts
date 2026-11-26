import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'

// Proxy do /admin/nike → backend /api/admin/sources/... (Bearer só no servidor)
// Enviar espera a fila do WhatsApp (20–40s entre mensagens)
export const maxDuration = 90

async function proxy(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params
  const secret = process.env.ADMIN_SECRET
  const cookieStore = await cookies()
  if (!secret || !(await isValidAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (path.length > 2 || !path.every(p => /^[a-z0-9-]+$/i.test(p))) {
    return NextResponse.json({ error: 'Caminho inválido' }, { status: 400 })
  }
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const hasBody = request.method !== 'GET'
  try {
    const res = await fetch(`${backendUrl}/api/admin/sources${path.length ? '/' + path.join('/') : ''}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${secret}`, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
      body: hasBody ? await request.text() : undefined,
      cache: 'no-store',
    })
    // Foto do post
    if (path[1] === 'image' && res.ok) {
      return new NextResponse(await res.arrayBuffer(), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } })
    }
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com o backend' }, { status: 502 })
  }
}

export { proxy as GET, proxy as POST }
