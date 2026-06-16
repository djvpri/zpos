import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const [laporan, terlaris, riwayat] = await Promise.all([
    sql`SELECT * FROM v_laporan_harian LIMIT 7`,
    sql`SELECT * FROM v_produk_terlaris LIMIT 5`,
    sql`SELECT * FROM transaksi ORDER BY created_at DESC LIMIT 10`,
  ])
  return NextResponse.json({ laporan, terlaris, riwayat })
}
