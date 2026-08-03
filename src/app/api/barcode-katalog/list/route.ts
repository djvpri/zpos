import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Daftar isi katalog barcode pusat (global). Admin-only. Dipakai halaman
// "Katalog Barcode": cari barcode/nama, lihat total & sumber data.
// query: ?cari=...&limit=100 (default 100, maks 500)

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 })

  const url = new URL(req.url)
  const cari = (url.searchParams.get('cari') || '').trim()
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500)

  const where = cari
    ? sql`WHERE barcode ILIKE ${'%' + cari + '%'} OR LOWER(nama) LIKE ${'%' + cari.toLowerCase() + '%'}`
    : sql``

  const [totalRow] = await sql`SELECT count(*)::int AS total FROM barcode_katalog`
  const rows = await sql`
    SELECT barcode, nama, merek, kategori, sumber, hits, dipakai_at, created_at
    FROM barcode_katalog
    ${where}
    ORDER BY COALESCE(dipakai_at, created_at) DESC
    LIMIT ${limit}
  `

  return NextResponse.json({ total: totalRow.total, rows })
}
