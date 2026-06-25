import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()
  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_SECRET não configurado no servidor' }, { status: 503 })
  }

  if (password !== secret) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('admin_token', secret, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
