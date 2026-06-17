import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'
import { bolehLogin, catatGagal, resetPercobaan, ipDari } from '@/lib/ratelimit'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const kunci = `login:${String(email ?? '').toLowerCase().trim()}`
  const ip = ipDari(req)
  if (!(await bolehLogin(kunci))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }, { status: 429 })
  }

  const [user] = await sql`
    SELECT u.id, u.nama, u.email, u.password_hash, u.role, u.aktif,
           t.id as toko_id, t.nama as toko_nama, t.plan
    FROM "user" u
    JOIN toko t ON t.id = u.toko_id
    WHERE u.email = ${email} AND u.aktif = true AND t.aktif = true
  `

  if (!user) {
    await catatGagal(kunci, ip)
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    await catatGagal(kunci, ip)
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  await resetPercobaan(kunci)

  const token = await signToken({
    userId: user.id,
    tokoId: user.toko_id,
    nama: user.toko_nama,
    userName: user.nama,
    email: user.email,
    plan: user.plan,
    role: user.role,
  })
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
