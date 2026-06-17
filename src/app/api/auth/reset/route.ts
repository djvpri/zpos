import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { verifyResetToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Token dan password wajib diisi' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
  }

  const payload = await verifyResetToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Tautan tidak valid atau sudah kedaluwarsa' }, { status: 400 })
  }

  const [user] = await sql`SELECT id FROM "user" WHERE id = ${payload.userId} AND email = ${payload.email}`
  if (!user) {
    return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
  }

  const password_hash = await bcrypt.hash(password, 10)
  await sql`UPDATE "user" SET password_hash = ${password_hash} WHERE id = ${payload.userId}`

  return NextResponse.json({ ok: true })
}
