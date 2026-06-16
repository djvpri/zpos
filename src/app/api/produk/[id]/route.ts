import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const [row] = await sql`
    UPDATE produk
    SET nama = ${body.nama}, harga = ${body.harga}, stok = ${body.stok},
        emoji = ${body.emoji}, kategori_id = ${body.kategori_id}
    WHERE id = ${Number(id)}
    RETURNING *
  `
  return NextResponse.json(row)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await sql`UPDATE produk SET aktif = false WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
