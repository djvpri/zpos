import { NextResponse } from 'next/server'
import { signAdminToken } from '@/lib/auth'
import { bolehLogin, catatGagal, resetPercobaan, ipDari } from '@/lib/ratelimit'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Admin belum dikonfigurasi (set ADMIN_EMAIL & ADMIN_PASSWORD)' }, { status: 500 })
  }

  const kunci = 'admin-login'
  const ip = ipDari(req)
  if (!(await bolehLogin(kunci))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }, { status: 429 })
  }

  if (email !== adminEmail || password !== adminPassword) {
    await catatGagal(kunci, ip)
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  await resetPercobaan(kunci)
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
