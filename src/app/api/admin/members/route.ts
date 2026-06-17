import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT t.id, t.nama, t.email, t.plan, t.aktif, t.created_at,
      (SELECT count(*) FROM "user" u WHERE u.toko_id = t.id) AS jumlah_user
    FROM toko t
    ORDER BY t.created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nama, email, password, plan } = await req.json()
  if (!nama?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Nama toko, email, dan password wajib diisi' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
  }
  const planFinal = plan === 'trial' ? 'trial' : 'pro'

  const existing = await sql`SELECT id FROM "user" WHERE email = ${email.trim()}`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const [toko] = await sql`
    INSERT INTO toko (nama, email, password_hash, plan)
    VALUES (${nama.trim()}, ${email.trim()}, ${password_hash}, ${planFinal})
    RETURNING id, nama, email, plan, aktif, created_at
  `

  await sql`
    INSERT INTO "user" (toko_id, nama, email, password_hash, role)
    VALUES (${toko.id}, ${nama.trim()}, ${email.trim()}, ${password_hash}, 'owner')
  `

  await sql`
    INSERT INTO kategori (nama, toko_id) VALUES
    ('Makanan', ${toko.id}), ('Minuman', ${toko.id}),
    ('Snack', ${toko.id}), ('Lainnya', ${toko.id})
  `

  return NextResponse.json({ ...toko, jumlah_user: 1 }, { status: 201 })
}
