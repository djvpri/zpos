import { NextResponse } from 'next/server'
import { signAdminToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Admin belum dikonfigurasi (set ADMIN_EMAIL & ADMIN_PASSWORD)' }, { status: 500 })
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const token = await signAdminToken(adminEmail)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('zpos_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
