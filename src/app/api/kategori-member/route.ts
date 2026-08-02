import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { kategoriMemberSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

// GET daftar kategori member milik toko (kasir & admin)
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`SELECT id, nama, diskon_persen FROM kategori_member WHERE toko_id = ${toko.tokoId} ORDER BY id`
  return NextResponse.json(rows)
}

// POST tambah kategori member
export const POST = apiHandler(async (req: Request, body: { nama: string; diskon_persen: number }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const diskon = Math.max(0, Math.min(100, body.diskon_persen ?? 0))
  try {
    const [row] = await sql`
      INSERT INTO kategori_member (nama, diskon_persen, toko_id)
      VALUES (${body.nama.trim()}, ${diskon}, ${toko.tokoId}) RETURNING id, nama, diskon_persen
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') return NextResponse.json({ error: 'Nama kategori member sudah dipakai' }, { status: 400 })
    console.error('kategori_member POST error', e)
    return NextResponse.json({ error: 'Gagal menambah kategori member' }, { status: 500 })
  }
}, { schema: kategoriMemberSchema })
