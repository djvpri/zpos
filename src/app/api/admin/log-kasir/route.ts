import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// Baca log error z1 kasir dari SEMUA toko — owner-only. Bisa filter toko, device,
// atau tanggal. Default: 50 baris terakhir dari semua toko.
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tokoId = url.searchParams.get('toko_id')
  const deviceId = url.searchParams.get('device_id')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500)

  let rows
  if (tokoId) {
    rows = await sql`
      SELECT l.id, l.toko_id, t.nama AS toko_nama, l.device_id, l.nama_pc, l.konten, l.created_at
      FROM log_kasir l
      JOIN toko t ON t.id = l.toko_id
      WHERE l.toko_id = ${Number(tokoId)}
      ORDER BY l.id DESC LIMIT ${limit}
    `
  } else if (deviceId) {
    rows = await sql`
      SELECT l.id, l.toko_id, t.nama AS toko_nama, l.device_id, l.nama_pc, l.konten, l.created_at
      FROM log_kasir l
      JOIN toko t ON t.id = l.toko_id
      WHERE l.device_id = ${deviceId}
      ORDER BY l.id DESC LIMIT ${limit}
    `
  } else {
    rows = await sql`
      SELECT l.id, l.toko_id, t.nama AS toko_nama, l.device_id, l.nama_pc, l.konten, l.created_at
      FROM log_kasir l
      JOIN toko t ON t.id = l.toko_id
      ORDER BY l.id DESC LIMIT ${limit}
    `
  }

  return NextResponse.json(rows)
}