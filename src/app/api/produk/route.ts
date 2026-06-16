import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const rows = await sql`
    SELECT p.*, json_build_object('nama', k.nama) AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.aktif = true
    ORDER BY p.nama
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [row] = await sql`
    INSERT INTO produk (nama, harga, stok, emoji, kategori_id)
    VALUES (${body.nama}, ${body.harga}, ${body.stok}, ${body.emoji}, ${body.kategori_id})
    RETURNING *
  `
  return NextResponse.json(row)
}
