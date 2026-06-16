import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT p.*, json_build_object('nama', k.nama) AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.aktif = true AND p.toko_id = ${toko.tokoId}
    ORDER BY p.nama
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const [row] = await sql`
    INSERT INTO produk (nama, harga, stok, emoji, kategori_id, toko_id)
    VALUES (${body.nama}, ${body.harga}, ${body.stok}, ${body.emoji}, ${body.kategori_id}, ${toko.tokoId})
    RETURNING *
  `
  return NextResponse.json(row)
}
