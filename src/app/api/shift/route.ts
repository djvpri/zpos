import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { shiftSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'

const withTotals = (tokoId: number) => sql`
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

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await withTotals(toko.tokoId)
  const filtered = toko.role === 'admin'
    ? rows
    : rows.filter((s) => s.kasir_nama === toko.userName)

  return NextResponse.json(filtered)
}

export const POST = apiHandler(async (req: Request, body: { modal_awal?: number; user_id?: number }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Kasir Tauri (token admin) buka shift utk kasir lokal tertentu via `user_id`.
  // Hanya role admin yg boleh assign — cegah kasir biasa membuka shift orang lain.
  // Tanpa `user_id`, shift melekat ke user token (perilaku web biasa).
  let targetUserId = toko.userId
  let targetNama = toko.userName
  if (body.user_id) {
    if (toko.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [u] = await sql`SELECT id, nama FROM "user" WHERE id = ${Number(body.user_id)} AND toko_id = ${toko.tokoId}`
    if (!u) return NextResponse.json({ error: 'User tidak ditemukan di toko ini' }, { status: 400 })
    targetUserId = u.id
    targetNama = u.nama
  }
  if (!targetUserId) return NextResponse.json({ error: 'Invalid user' }, { status: 400 })

  const [existing] = await sql`
    SELECT id FROM shift WHERE toko_id = ${toko.tokoId} AND user_id = ${targetUserId} AND aktif = true LIMIT 1
  `
  if (existing) return NextResponse.json({ error: 'Shift sudah aktif' }, { status: 400 })

  const [shift] = await sql`
    INSERT INTO shift (toko_id, user_id, kasir_nama, modal_awal)
    VALUES (${toko.tokoId}, ${targetUserId}, ${targetNama}, ${Math.max(0, Number(body.modal_awal ?? 0) || 0)})
    RETURNING *
  `

  // Audit: catat buka shift + modal awal (cek penggelembungan modal/kecurangan).
  void catatAktivitas(toko, 'shift_buka',
    `Buka shift #${shift.id} · modal Rp ${Number(shift.modal_awal || 0).toLocaleString('id-ID')}`)

  return NextResponse.json(shift)
}, { schema: shiftSchema })
