import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

async function isValid(token: string): Promise<boolean> {
  try { await jwtVerify(token, secret); return true } catch { return false }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('zpos_token')?.value

  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isApiAuth = pathname.startsWith('/api/auth')
  const isAppRoute = pathname.startsWith('/app')

  // API auth routes: always allow
  if (isApiAuth) return NextResponse.next()

  // Login/register: redirect to /app if already logged in
  if (isAuthPage) {
    if (token && await isValid(token)) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return NextResponse.next()
  }

  // /app routes: require auth
  if (isAppRoute) {
    if (!token || !(await isValid(token))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // Landing page and other public routes: always allow
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*|.*\\.svg|.*\\.ico).*)'],
}
