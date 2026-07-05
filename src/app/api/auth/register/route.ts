import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'
import { registerSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

export const POST = apiHandler(async (req: Request, body: { nama: string; email: string; password: string }) => {
  const { nama, email, password } = body

  const existing = await sql`SELECT id FROM "user" WHERE email = ${email}`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const trialSampai = new Date()
  trialSampai.setDate(trialSampai.getDate() + 30)

  const [toko] = await sql`
    INSERT INTO toko (nama, email, password_hash, langganan_sampai)
    VALUES (${nama}, ${email}, ${password_hash}, ${trialSampai})
    RETURNING id, nama, plan
  `

  const [user] = await sql`
    INSERT INTO "user" (toko_id, nama, email, password_hash, role)
    VALUES (${toko.id}, ${nama}, ${email}, ${password_hash}, 'admin')
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
    role: 'admin',
  })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('zpos_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}, { schema: registerSchema })
