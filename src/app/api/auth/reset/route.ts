import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { verifyResetToken } from '@/lib/auth'
import { resetSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

export const POST = apiHandler(async (req: Request, body: { token: string; password: string }) => {
  const { token, password } = body

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
}, { schema: resetSchema })
