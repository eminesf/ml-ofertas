import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminSessionToken, safeEqual } from '@/lib/admin-auth'

// Freio contra força bruta: cada erro espera 1,5s, e um IP com muitas falhas
// seguidas fica bloqueado por 15 min (memória da instância; não é perfeito em
// serverless, mas encarece bastante o ataque).
const failures = new Map<string, { count: number; until: number }>()
const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  const entry = failures.get(ip)
  if (entry && entry.until > Date.now()) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente de novo em 15 minutos.' }, { status: 429 })
  }

  const { password } = await request.json().catch(() => ({ password: '' }))
  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_SECRET não configurado no servidor' }, { status: 503 })
  }

  if (typeof password !== 'string' || !safeEqual(password, secret)) {
    const count = (entry?.count ?? 0) + 1
    failures.set(ip, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 })
    await new Promise(r => setTimeout(r, 1500))
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  failures.delete(ip)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, await adminSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
