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

  if (isApiAuth) return NextResponse.next()

  if (isAuthPage) {
    if (token && await isValid(token)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (!token || !(await isValid(token))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.ico).*)'],
}
