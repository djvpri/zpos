import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Batalkan (void) transaksi: kembalikan stok & keluarkan dari laporan.
// Hanya owner. Tidak menghapus baris agar jejak audit tetap ada.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const trxId = parseInt(id)

  const [trx] = await sql`
    SELECT id, dibatalkan FROM transaksi WHERE id = ${trxId} AND toko_id = ${toko.tokoId}
  `
  if (!trx) return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
  if (trx.dibatalkan) return NextResponse.json({ error: 'Transaksi sudah dibatalkan' }, { status: 400 })

  await sql.begin(async (sql) => {
    // Kembalikan stok untuk tiap item (lewati produk yang sudah dihapus)
    const items = await sql`
      SELECT produk_id, qty FROM detail_transaksi
      WHERE transaksi_id = ${trxId} AND produk_id IS NOT NULL
    `
    for (const it of items) {
      await sql`
        UPDATE produk SET stok = stok + ${it.qty}, updated_at = now()
        WHERE id = ${it.produk_id} AND toko_id = ${toko.tokoId}
      `
    }
    await sql`UPDATE transaksi SET dibatalkan = true WHERE id = ${trxId}`
  })

  return NextResponse.json({ ok: true })
}
