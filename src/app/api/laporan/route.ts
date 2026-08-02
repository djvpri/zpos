import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = toko.tokoId

  const [laporan, terlaris, riwayat] = await Promise.all([
    sql`
      SELECT date_trunc('day', created_at) AS tanggal,
        count(*) AS jumlah_transaksi,
        sum(total) AS total_penjualan,
        round(avg(total)) AS rata_rata,
        sum(diskon) AS total_diskon
      FROM transaksi
      WHERE toko_id = ${id} AND dibatalkan = false
      GROUP BY date_trunc('day', created_at)
      ORDER BY tanggal DESC
      LIMIT 7
    `,
    sql`
      SELECT p.id, p.nama, p.emoji,
        coalesce(sum(dt.qty), 0) AS total_qty,
        coalesce(sum(dt.subtotal), 0) AS total_penjualan
      FROM produk p
      LEFT JOIN detail_transaksi dt ON dt.produk_id = p.id AND dt.toko_id = ${id}
        AND dt.transaksi_id IN (SELECT id FROM transaksi WHERE toko_id = ${id} AND dibatalkan = false)
      WHERE p.toko_id = ${id}
      GROUP BY p.id, p.nama, p.emoji
      ORDER BY total_qty DESC
      LIMIT 5
    `,
    sql`SELECT * FROM transaksi WHERE toko_id = ${id} ORDER BY created_at DESC LIMIT 10`,
  ])

  return NextResponse.json({ laporan, terlaris, riwayat })
}
