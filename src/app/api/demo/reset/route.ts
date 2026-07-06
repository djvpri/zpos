import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { seedDataDemo, bersihkanDataToko } from '@/lib/demo-seed'

const DEMO_BERLAKU_JAM = 2

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pengecekan KRUSIAL — pastikan cuma tenant demo yang bisa di-reset
  // lewat endpoint ini. Kalau tidak dicek, endpoint ini bisa dipakai
  // untuk menghapus seluruh data toko ASLI siapa pun yang sedang login.
  const [row] = await sql`SELECT is_demo FROM toko WHERE id = ${toko.tokoId}`
  if (!row?.is_demo) {
    return NextResponse.json({ error: 'Bukan tenant demo, tidak bisa direset lewat sini' }, { status: 403 })
  }

  await bersihkanDataToko(toko.tokoId)
  await seedDataDemo(toko.tokoId)

  // Reset juga memperpanjang masa aktif demo — supaya pengunjung yang
  // reset tidak tiba-tiba kena hapus otomatis di tengah eksplorasi.
  const demoExpiresAt = new Date(Date.now() + DEMO_BERLAKU_JAM * 60 * 60 * 1000)
  await sql`UPDATE toko SET demo_expires_at = ${demoExpiresAt} WHERE id = ${toko.tokoId}`

  return NextResponse.json({ ok: true })
}
