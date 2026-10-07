import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// Baca log error z1 kasir dari SEMUA toko — owner-only. Bisa filter toko, device,
// atau tanggal. Return: { rows, stats, devices } — stats = agregasi utk dashboard
// cards, devices = health per device (24 jam).
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tokoId = url.searchParams.get('toko_id')
  const deviceId = url.searchParams.get('device_id')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500)

  // Stat cards: agregasi 7 hari & 24 jam
  const [stats] = await sql`
    SELECT
      (count(*) FILTER (WHERE created_at > now() - interval '7 days'))::int AS total_7d,
      (count(*) FILTER (WHERE konten ~* 'gagal|error|panic' AND created_at > now() - interval '24 hours'))::int AS err_24h,
      (count(DISTINCT device_id) FILTER (WHERE created_at > now() - interval '24 hours'))::int AS active_devices,
      (count(DISTINCT toko_id) FILTER (WHERE created_at > now() - interval '7 days'))::int AS active_tenants
    FROM log_kasir
  `

  // Device health: per device 30 hari (semua device pernah kirim log, bukan hanya aktif 24h)
  const devices = await sql`
    SELECT
      l.device_id,
      max(l.nama_pc) AS nama_pc,
      l.toko_id,
      max(t.nama) AS toko_nama,
      count(*)::int AS total,
      (count(*) FILTER (WHERE l.konten ~* 'sync GAGAL'))::int AS gagal,
      (count(*) FILTER (WHERE l.konten ~* 'sync OK'))::int AS ok,
      max(l.created_at) AS last_seen,
      min(l.created_at) AS first_seen,
      substring(max(l.konten) FILTER (WHERE l.konten ~* 'wifi=') from 'wifi=([^ |]+)') AS wifi_name
    FROM log_kasir l
    JOIN toko t ON t.id = l.toko_id
    WHERE l.created_at > now() - interval '30 days'
    GROUP BY l.device_id, l.toko_id
    ORDER BY max(l.created_at) DESC
  `

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

  return NextResponse.json({ rows, stats, devices })
}
