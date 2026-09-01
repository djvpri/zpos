import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// Owner: daftar produk digital semua tenant (utk set margin di UI admin).
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tokoId = searchParams.get('toko') ? parseInt(searchParams.get('toko')!, 10) : null

  const rows = await sql`
    SELECT p.id, p.nama, p.harga, p.stok, p.modal, p.buyer_sku_code, p.digital_brand,
           p.margin_type, p.margin_persen, p.margin_nominal, p.aktif,
           t.nama AS toko_nama, t.id AS toko_id
    FROM produk p
    JOIN toko t ON t.id = p.toko_id
    WHERE p.jenis = 'digital'
    ${tokoId ? sql`AND p.toko_id = ${tokoId}` : sql``}
    ORDER BY t.nama, p.nama
  `
  return NextResponse.json({ rows })
}
