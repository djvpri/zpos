import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

const withTotals = (tokoId: number, extraWhere: string = '') => sql`
  SELECT
    s.id, s.kasir_nama, s.modal_awal, s.buka_at, s.tutup_at, s.aktif,
    COUNT(t.id)  FILTER (WHERE t.dibatalkan IS NOT TRUE)::int          AS jumlah_transaksi,
    COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE), 0)::int  AS total_penjualan,
    COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'Tunai'),    0)::int AS total_tunai,
    COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'QRIS'),     0)::int AS total_qris,
    COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'Transfer'), 0)::int AS total_transfer
  FROM shift s
  LEFT JOIN transaksi t ON t.shift_id = s.id AND t.toko_id = s.toko_id
  WHERE s.toko_id = ${tokoId}
  GROUP BY s.id
  ORDER BY s.buka_at DESC
  LIMIT 50
`

// GET: list shift (admin: semua, kasir: hanya milik sendiri)
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await withTotals(toko.tokoId)
  const filtered = toko.role === 'admin'
    ? rows
    : rows.filter((s: any) => s.kasir_nama === toko.userName)

  return NextResponse.json(filtered)
}

// POST: buka shift baru
export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cek shift aktif yang sudah ada
  const [existing] = await sql`
    SELECT id FROM shift WHERE toko_id = ${toko.tokoId} AND user_id = ${toko.userId} AND aktif = true LIMIT 1
  `
  if (existing) return NextResponse.json({ error: 'Shift sudah aktif' }, { status: 400 })

  const { modal_awal = 0 } = await req.json().catch(() => ({}))

  const [shift] = await sql`
    INSERT INTO shift (toko_id, user_id, kasir_nama, modal_awal)
    VALUES (${toko.tokoId}, ${toko.userId}, ${toko.userName}, ${Math.max(0, Number(modal_awal) || 0)})
    RETURNING *
  `
  return NextResponse.json(shift)
}
