import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const katId = parseInt(id)

  const [kat] = await sql`SELECT id, nama FROM kategori WHERE id = ${katId} AND toko_id = ${toko.tokoId}`
  if (!kat) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })

  await sql`UPDATE produk SET kategori_id = NULL WHERE kategori_id = ${katId} AND toko_id = ${toko.tokoId}`
  await sql`DELETE FROM kategori WHERE id = ${katId}`

  void catatAktivitas(toko, 'data_hapus', `Kategori "${kat.nama}" dihapus`)
  return NextResponse.json({ ok: true })
}
