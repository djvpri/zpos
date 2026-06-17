import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const [row] = await sql`
    UPDATE produk
    SET nama = ${body.nama}, harga = ${body.harga}, stok = ${body.stok},
        emoji = ${body.emoji}, deskripsi = ${body.deskripsi || null}, foto_url = ${body.foto_url || null},
        barcode = ${body.barcode || null}, kategori_id = ${body.kategori_id}
    WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}
    RETURNING *
  `
  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await sql`UPDATE produk SET aktif = false WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}`
  return NextResponse.json({ ok: true })
}
