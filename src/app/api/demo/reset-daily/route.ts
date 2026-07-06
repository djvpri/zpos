import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getDemoResetSecret } from '@/lib/secrets'
import { seedDataDemo, bersihkanDataToko } from '@/lib/demo-seed'

export const runtime = 'nodejs'

// Dipanggil Railway Cron Job 1x/hari — BUKAN oleh sesi user (tidak ada
// login di sini sama sekali), makanya proteksinya secret di header, bukan
// cookie/JWT session seperti endpoint lain.
//
// Akun demo di ekosistem ini SATU saja (demo@zomet.my.id, didaftarkan
// manual lewat Z One seperti user biasa, lalu ditandai is_demo=true di
// tabel toko ZPOS) — dipakai bersama semua pengunjung, direset ke kondisi
// bersih tiap hari. Cari lewat flag is_demo (bukan hardcode email di
// sini), supaya kalau suatu saat emailnya diganti, cukup pindahkan
// flag-nya, tidak perlu ubah kode ini.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')

  let cocok: boolean
  try {
    cocok = token === getDemoResetSecret()
  } catch {
    cocok = false // secret belum di-set di env -> fail-closed, tolak semua
  }
  if (!cocok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokoDemo = await sql`SELECT id, nama FROM toko WHERE is_demo = true`
  if (tokoDemo.length === 0) {
    return NextResponse.json({ ok: true, pesan: 'Tidak ada toko demo (is_demo=true belum di-set).' })
  }

  const hasil = []
  for (const t of tokoDemo) {
    await bersihkanDataToko(t.id)
    await seedDataDemo(t.id)
    hasil.push({ tokoId: t.id, nama: t.nama })
  }

  return NextResponse.json({ ok: true, direset: hasil })
}
