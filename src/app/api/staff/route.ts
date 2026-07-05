import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { staffSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

export async function GET(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const staff = await sql`
    SELECT id, nama, email, role, aktif, created_at
    FROM "user"
    WHERE toko_id = ${auth.tokoId} AND role = 'kasir'
    ORDER BY created_at ASC
  `
  return NextResponse.json(staff)
}

export const POST = apiHandler(async (req: Request, body: { nama: string; email: string; password: string }) => {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { nama, email, password } = body

  const existing = await sql`SELECT id FROM "user" WHERE email = ${email}`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)
  const [user] = await sql`
    INSERT INTO "user" (toko_id, nama, email, password_hash, role)
    VALUES (${auth.tokoId}, ${nama}, ${email}, ${password_hash}, 'kasir')
    RETURNING id, nama, email, role, aktif, created_at
  `
  return NextResponse.json(user, { status: 201 })
}, { schema: staffSchema })
