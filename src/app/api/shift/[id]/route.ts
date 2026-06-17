import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// GET: detail shift + totals (untuk rekap sebelum tutup)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await sql`
    SELECT
      s.id, s.kasir_nama, s.modal_awal, s.buka_at, s.tutup_at, s.aktif,
      COUNT(t.id)  FILTER (WHERE t.dibatalkan IS NOT TRUE)::int          AS jumlah_transaksi,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE), 0)::int  AS total_penjualan,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'Tunai'),    0)::int AS total_tunai,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'QRIS'),     0)::int AS total_qris,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'Transfer'), 0)::int AS total_transfer
    FROM shift s
    LEFT JOIN transaksi t ON t.shift_id = s.id AND t.toko_id = s.toko_id
    WHERE s.id = ${Number(id)} AND s.toko_id = ${toko.tokoId}
    GROUP BY s.id
  `
  if (!row) return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })
  return NextResponse.json(row)
}

// PATCH: tutup shift
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [shift] = await sql`
    SELECT id, aktif, user_id FROM shift
    WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}
  `
  if (!shift) return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })
  if (!shift.aktif) return NextResponse.json({ error: 'Shift sudah ditutup' }, { status: 400 })
  // owner boleh tutup shift siapapun; kasir hanya bisa tutup miliknya
  if (toko.role !== 'owner' && shift.user_id !== toko.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`UPDATE shift SET aktif = false, tutup_at = now() WHERE id = ${Number(id)}`

  // Return detail + totals
  const [detail] = await sql`
    SELECT
      s.id, s.kasir_nama, s.modal_awal, s.buka_at, s.tutup_at, s.aktif,
      COUNT(t.id)  FILTER (WHERE t.dibatalkan IS NOT TRUE)::int          AS jumlah_transaksi,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE), 0)::int  AS total_penjualan,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'Tunai'),    0)::int AS total_tunai,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'QRIS'),     0)::int AS total_qris,
      COALESCE(SUM(t.total) FILTER (WHERE t.dibatalkan IS NOT TRUE AND t.metode_bayar = 'Transfer'), 0)::int AS total_transfer
    FROM shift s
    LEFT JOIN transaksi t ON t.shift_id = s.id AND t.toko_id = s.toko_id
    WHERE s.id = ${Number(id)}
    GROUP BY s.id
  `
  return NextResponse.json(detail)
}
