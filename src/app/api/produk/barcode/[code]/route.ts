import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const [row] = await sql`
    SELECT p.*, json_build_object('nama', k.nama) AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.barcode = ${code} AND p.toko_id = ${toko.tokoId} AND p.aktif = true
  `
  if (!row) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
  return NextResponse.json(row)
}
