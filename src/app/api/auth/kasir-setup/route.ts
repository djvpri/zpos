import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { apiHandler } from '@/lib/api-handler'
import { signToken } from '@/lib/auth'
import { loginSchema } from '@/lib/validation'
import { bolehLogin, catatGagal, resetPercobaan, ipDari } from '@/lib/ratelimit'
import { catatAktivitas } from '@/lib/aktivitas'

// Setup login PIN offline utk app ZPos Kasir, oleh OWNER tenant (bukan kasir).
//
// Admin tenant isi email + password akun ZPos-nya. Server verifikasi persis spt
// login: user aktif + toko aktif + bcrypt.correct. JIKA owner -> ambil daftar
// user utk TOKO user tsb (scope ke toko sendiri, aman multiclient), pastikan
// tiap user aktif punya kasir_pin_hash (generate default '0000<id>' belum ada),
// lalu balik {toko_id, toko_nama, users:[{id,nama,role,aktif,kasir_pin_hash}]}.
//
// PIN default = 6 digit dari id: id 7 -> '000007'. Beda per user, kasir tahu
// PIN = id-nya dalam 6 digit. (Admin web bisa ubah/umumkan nanti.)
const defaultPin = (id: number) => String(id).padStart(6, '0')

export const POST = apiHandler(async (req: Request, body: { email: string; password: string }) => {
  const { email, password } = body

  const kunci = `login:${email.toLowerCase().trim()}`
  const ip = ipDari(req)
  if (!(await bolehLogin(kunci))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' }, { status: 429 })
  }

  const [user] = await sql`
    SELECT u.id, u.nama, u.email, u.password_hash, u.role, u.aktif,
           t.id as toko_id, t.nama as toko_nama, t.plan
    FROM "user" u
    JOIN toko t ON t.id = u.toko_id
    WHERE u.email = ${email} AND u.aktif = true AND t.aktif = true
    LIMIT 1
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

  // Setup PIN hanya utk ADMIN tenant (owner) — kasir tak boleh tarik daftar staff.
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin toko yang bisa setup kasir' }, { status: 403 })
  }

  // JWT access token utk app pakai sinkron katalog/member setelah setup
  // (server baca cookie `zpos_token`). Sama skema dgn /api/auth/login.
  const token = await signToken({
    userId: user.id,
    tokoId: user.toko_id,
    nama: user.toko_nama,
    userName: user.nama,
    email: user.email,
    plan: user.plan,
    role: user.role,
  })

  // Ambil semua user aktif dalam toko user ini (scope toko sendiri).
  const users = await sql`
    SELECT id, nama, role, aktif, kasir_pin_hash
    FROM "user"
    WHERE toko_id = ${user.toko_id} AND aktif = true
    ORDER BY nama
  `

  // Generate + simpan hash PIN default untuk yg belum punya.
  const hasil: { id: number; toko_id: number; nama: string; email: string; role: string; aktif: boolean; kasir_pin_hash: string }[] = []
  for (const u of users as unknown as { id: number; nama: string; email: string; role: string; aktif: boolean; kasir_pin_hash: string | null }[]) {
    let hash = u.kasir_pin_hash
    if (!hash) {
      hash = await bcrypt.hash(defaultPin(u.id), 10)
      await sql`UPDATE "user" SET kasir_pin_hash = ${hash} WHERE id = ${u.id}`
    }
    hasil.push({
      id: u.id,
      toko_id: user.toko_id,
      nama: u.nama,
      email: u.email ?? '',
      role: u.role,
      aktif: !!u.aktif,
      kasir_pin_hash: hash,
    })
  }

  // Audit: catat setup (fire-and-forget).
  void catatAktivitas(
    { tokoId: user.toko_id, userId: user.id, userName: user.nama, role: user.role },
    'kasir_setup',
    `Setup kasir: ${hasil.length} staff (PIN default utk belum punya)`,
  )

  return NextResponse.json({ toko_id: user.toko_id, toko_nama: user.toko_nama, token, users: hasil })
}, { schema: loginSchema })
