import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { memberSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'

// PUT update member
export const PUT = apiHandler(async (req: Request, body: { nama: string; telepon?: string | null; kategori_member_id?: number | null }, context) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number((await context.params).id)
  const kategoriId = body.kategori_member_id ?? null
  if (kategoriId) {
    const [kat] = await sql`SELECT id FROM kategori_member WHERE id = ${kategoriId} AND toko_id = ${toko.tokoId}`
    if (!kat) return NextResponse.json({ error: 'Kategori member tidak valid' }, { status: 400 })
  }

  const [row] = await sql`
    UPDATE member SET nama = ${body.nama.trim()}, telepon = ${body.telepon || null}, kategori_member_id = ${kategoriId}
    WHERE id = ${id} AND toko_id = ${toko.tokoId}
    RETURNING id, nama, telepon, kategori_member_id, created_at
  `
  if (!row) return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 404 })

  void catatAktivitas(toko, 'member_ubah', `Member #${row.id} "${row.nama}" diperbarui`)
  return NextResponse.json(row)
}, { schema: memberSchema })

// DELETE hapus member
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number((await context.params).id)
  const [row] = await sql`DELETE FROM member WHERE id = ${id} AND toko_id = ${toko.tokoId} RETURNING id, nama`
  if (!row) return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 404 })

  // Audit: hapus member permanen — tak bisa dilacak nanti, catat nama sebelumnya.
  void catatAktivitas(toko, 'member_hapus', `Member #${id} "${row.nama}" dihapus permanen`)
  return NextResponse.json({ ok: true })
}
