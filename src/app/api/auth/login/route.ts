import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const [toko] = await sql`SELECT * FROM toko WHERE email = ${email} AND aktif = true`
  if (!toko) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, toko.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const token = await signToken({ tokoId: toko.id, nama: toko.nama, email: toko.email, plan: toko.plan })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('zpos_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
