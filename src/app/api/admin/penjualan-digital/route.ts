import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// Laporan owner: semua penjualan digital semua tenant + margin owner per item.
// Margin owner per item = harga_debet (didebit dari saldo tenant) − modal (harga Digiflazz).
// Baris Pending/Gagal tetap tampil (status gandakan transparansi); margin dihitung
// berdasarkan harga_debet yang ditarik (item Gagal tak didebit → margin 0).
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000)
  const tokoId = searchParams.get('toko') ? parseInt(searchParams.get('toko')!, 10) : null

  const rows = await sql`
    SELECT
      td.id, td.transaksi_id, td.buyer_sku_code, td.customer_no, td.ref_id,
      td.commands, td.modal, td.harga_debet, td.harga_jual, td.status, td.sn,
      td.message, td.created_at, td.produk_id,
      t.nama AS toko_nama, t.id AS toko_id,
      COALESCE(td.harga_debet, 0) - COALESCE(td.modal, 0) AS margin_owner
    FROM transaksi_digital td
    JOIN toko t ON t.id = td.toko_id
    ${tokoId ? sql`WHERE td.toko_id = ${tokoId}` : sql``}
    ORDER BY td.created_at DESC
    LIMIT ${limit}
  `
  const tokoRows = await sql`SELECT id, nama FROM toko ORDER BY nama`
  return NextResponse.json({ rows, tokoList: tokoRows })
}
