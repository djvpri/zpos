import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { kategoriMemberSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

// PUT update kategori member (nama & diskon_persen)
export const PUT = apiHandler(async (req: Request, body: { nama: string; diskon_persen: number }, context) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number((await context.params).id)
  const diskon = body.diskon_persen ?? 0
  const [row] = await sql`
    UPDATE kategori_member SET nama = ${body.nama.trim()}, diskon_persen = ${diskon}
    WHERE id = ${id} AND toko_id = ${toko.tokoId} RETURNING id, nama, diskon_persen
  `
  if (!row) return NextResponse.json({ error: 'Kategori member tidak ditemukan' }, { status: 404 })
  return NextResponse.json(row)
}, { schema: kategoriMemberSchema })

// DELETE hapus kategori member (member terikat jadi kategori_member_id NULL via ON DELETE SET NULL)
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number((await context.params).id)
  const [row] = await sql`DELETE FROM kategori_member WHERE id = ${id} AND toko_id = ${toko.tokoId} RETURNING id`
  if (!row) return NextResponse.json({ error: 'Kategori member tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
