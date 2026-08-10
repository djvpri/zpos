import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Rentang tanggal opsional via query string (YYYY-MM-DD). Tanpa param =
// perilaku lama (7 hari terakhir). Satu fungsi ulang biar filter konsisten.
function rangeFilter(dari?: string | null, sampai?: string | null) {
  if (!dari || !sampai || !/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai))
    return sql``
  // sampai bersifat inkusif (termasuk akhir hari) → tambah 1 hari manual
  // tanpa timezone-math (hindari pergeseran UTC).
  const [y, m, d] = sampai.split('-').map(Number)
  const end = new Date(Date.UTC(y, m - 1, d + 1))
  const endISO = end.toISOString().slice(0, 10)
  return sql`AND created_at >= ${dari + 'T00:00:00'} AND created_at < ${endISO + 'T00:00:00'}`
}

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = toko.tokoId
  const url = new URL(req.url)
  const dari = url.searchParams.get('dari')
  const sampai = url.searchParams.get('sampai')

  // Filter transaksi (dipakai di blok laporan + riwayat), terpisah dari
  // filter hanya-dibatalkan agar komposisi query bersih.
  const t = rangeFilter(dari, sampai)

  const [laporan, terlaris, riwayat] = await Promise.all([
    sql`
      SELECT t.tanggal,
        t.jumlah_transaksi,
        t.total_penjualan,
        t.rata_rata,
        t.total_diskon,
        t.total_tunai,
        COALESCE(k.kas_keluar, 0)::bigint AS total_pengeluaran
      FROM (
        SELECT date_trunc('day', created_at) AS tanggal,
          count(*)::int AS jumlah_transaksi,
          sum(total)::bigint AS total_penjualan,
          round(avg(total))::bigint AS rata_rata,
          sum(diskon)::bigint AS total_diskon,
          coalesce(sum(total) FILTER (WHERE metode_bayar = 'Tunai'), 0)::bigint AS total_tunai
        FROM transaksi
        WHERE toko_id = ${id} AND dibatalkan = false ${t}
        GROUP BY date_trunc('day', created_at)
        ORDER BY tanggal DESC
        ${!dari ? sql`LIMIT 7` : sql``}
      ) t
      LEFT JOIN (
        SELECT date_trunc('day', dibuat_at) AS tanggal, sum(nominal) AS kas_keluar
        FROM kas_keluar
        WHERE toko_id = ${id} AND void = false
        GROUP BY date_trunc('day', dibuat_at)
      ) k ON k.tanggal = t.tanggal
      ORDER BY t.tanggal DESC
    `,
    sql`
      SELECT p.id, p.nama, p.emoji,
        coalesce(sum(dt.qty), 0)::int AS total_qty,
        coalesce(sum(dt.subtotal), 0)::bigint AS total_penjualan
      FROM produk p
      LEFT JOIN detail_transaksi dt ON dt.produk_id = p.id AND dt.toko_id = ${id}
        AND dt.transaksi_id IN (
          SELECT id FROM transaksi WHERE toko_id = ${id} AND dibatalkan = false ${t}
        )
      WHERE p.toko_id = ${id}
      GROUP BY p.id, p.nama, p.emoji
      ORDER BY total_qty DESC
      LIMIT 5
    `,
    dari && sampai
      ? sql`SELECT * FROM transaksi WHERE toko_id = ${id} ${t} ORDER BY created_at DESC LIMIT 200`
      : sql`SELECT * FROM transaksi WHERE toko_id = ${id} ORDER BY created_at DESC LIMIT 10`,
  ])

  return NextResponse.json(
    { laporan, terlaris, riwayat },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
