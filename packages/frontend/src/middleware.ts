import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'

// Protege /admin/*: o cookie precisa ser a sessão válida (HMAC do ADMIN_SECRET),
// não basta existir.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/admin/login'
  const valid = await isValidAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)

  if (!valid && !isLoginPage) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    const res = NextResponse.redirect(loginUrl)
    if (request.cookies.has(ADMIN_COOKIE)) res.cookies.delete(ADMIN_COOKIE)
    return res
  }

  if (valid && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
