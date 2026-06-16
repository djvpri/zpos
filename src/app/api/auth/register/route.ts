import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { nama, email, password } = await req.json()

  if (!nama || !email || !password) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
  }

  const existing = await sql`SELECT id FROM "user" WHERE email = ${email}`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const [toko] = await sql`
    INSERT INTO toko (nama, email, password_hash)
    VALUES (${nama}, ${email}, ${password_hash})
    RETURNING id, nama, plan
  `

  const [user] = await sql`
    INSERT INTO "user" (toko_id, nama, email, password_hash, role)
    VALUES (${toko.id}, ${nama}, ${email}, ${password_hash}, 'owner')
    RETURNING id
  `

  await sql`
    INSERT INTO kategori (nama, toko_id) VALUES
    ('Makanan', ${toko.id}), ('Minuman', ${toko.id}),
    ('Snack', ${toko.id}), ('Lainnya', ${toko.id})
  `

  const token = await signToken({
    userId: user.id,
    tokoId: toko.id,
    nama: toko.nama,
    userName: nama,
    email,
    plan: toko.plan,
    role: 'owner',
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
