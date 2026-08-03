import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'

// Login ZPos tanpa password, dipakai alur QR login desktop Opsi-A:
// kasir scan QR → approve di Z One (alur qrSession) → desktop dapat email →
// email ini diverifikasi Z One (user SUDAH login di HP) → desktop minta
// zpos_token di sini (by email). Aman: email berasal dari DB Z One pasca
// approval, bukan input user bebas.
export const POST = apiHandler(async (_req: Request, body: { email: string }) => {
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email wajib diisi' }, { status: 400 })

  const [user] = await sql`
    SELECT u.id, u.nama, u.email, u.role, u.aktif,
           t.id as toko_id, t.nama as toko_nama, t.plan, t.aktif as toko_aktif
    FROM "user" u
    JOIN toko t ON t.id = u.toko_id
    WHERE lower(u.email) = ${email} AND u.aktif = true AND t.aktif = true
    LIMIT 1
  `

  if (!user) {
    return NextResponse.json({ error: 'Email tidak terdaftar sebagai user ZPOS' }, { status: 404 })
  }

  const token = await signToken({
    userId: user.id,
    tokoId: user.toko_id,
    nama: user.toko_nama,
    userName: user.nama,
    email: user.email,
    plan: user.plan,
    role: user.role,
  })

  // Balik token JWT langsung (desktop reqwest tak pakai browser cookie).
  return NextResponse.json({ ok: true, token, email: user.email })
})
