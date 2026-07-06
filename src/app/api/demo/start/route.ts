import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'
import { seedDataDemo } from '@/lib/demo-seed'
import { bolehLogin, catatGagal, ipDari } from '@/lib/ratelimit'

const DEMO_BERLAKU_JAM = 2

// Bersihkan tenant demo yang sudah lewat waktu — dipanggil setiap kali ada
// yang mulai demo baru (lazy cleanup), bukan cron terpisah. Sengaja tidak
// pakai infrastruktur Railway cron tambahan — cukup "numpang" di setiap
// request /start untuk terus membersihkan diri seiring berjalan.
async function bersihkanDemoKedaluwarsa(): Promise<void> {
  const kedaluwarsa = await sql`
    SELECT id FROM toko WHERE is_demo = true AND demo_expires_at < now()
  `
  for (const t of kedaluwarsa) {
    // ON DELETE CASCADE di kategori/produk/transaksi/detail_transaksi/user
    // sudah menangani penghapusan data terkait — cukup hapus baris toko-nya.
    await sql`DELETE FROM toko WHERE id = ${t.id}`
  }
}

export async function POST(req: Request) {
  const ip = ipDari(req) || 'unknown'
  const kunciLimit = `demo:${ip}`

  // Maksimal 5 demo baru per IP per 15 menit (pakai mekanisme rate-limit
  // yang sama dengan anti-brute-force login, kunci berbeda) — cegah orang
  // spam bikin ratusan tenant demo asal-asalan.
  if (!(await bolehLogin(kunciLimit))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' }, { status: 429 })
  }
  await catatGagal(kunciLimit, ip)

  await bersihkanDemoKedaluwarsa()

  const idUnik = randomUUID().slice(0, 8)
  const nama = `Toko Demo`
  const email = `demo-${idUnik}@zpos.demo`
  const password_hash = await bcrypt.hash(randomUUID(), 10)
  const demoExpiresAt = new Date(Date.now() + DEMO_BERLAKU_JAM * 60 * 60 * 1000)

  const [toko] = await sql`
    INSERT INTO toko (nama, email, password_hash, plan, is_demo, demo_expires_at, langganan_sampai)
    VALUES (${nama}, ${email}, ${password_hash}, 'trial', true, ${demoExpiresAt}, ${demoExpiresAt})
    RETURNING id, nama, plan
  `

  const [user] = await sql`
    INSERT INTO "user" (toko_id, nama, email, password_hash, role)
    VALUES (${toko.id}, 'Kasir Demo', ${email}, ${password_hash}, 'admin')
    RETURNING id
  `

  await seedDataDemo(toko.id)

  const token = await signToken({
    userId: user.id,
    tokoId: toko.id,
    nama: toko.nama,
    userName: 'Kasir Demo',
    email,
    plan: toko.plan,
    role: 'admin',
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('zpos_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: DEMO_BERLAKU_JAM * 60 * 60,
    path: '/',
  })
  return res
}
