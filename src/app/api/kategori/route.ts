import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { kategoriSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

export async function GET(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT id, nama FROM kategori WHERE toko_id = ${toko.tokoId} ORDER BY id`
  return NextResponse.json(rows)
}

export const POST = apiHandler(async (req: Request, body: { nama: string }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await sql`
    SELECT id FROM kategori WHERE toko_id = ${toko.tokoId} AND lower(nama) = lower(${body.nama.trim()})
  `
  if (existing.length > 0) return NextResponse.json({ error: 'Kategori sudah ada' }, { status: 400 })

  try {
    const [row] = await sql`
      INSERT INTO kategori (nama, toko_id) VALUES (${body.nama.trim()}, ${toko.tokoId}) RETURNING id, nama
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'Nama kategori sudah dipakai' }, { status: 400 })
    }
    console.error('kategori POST error', e)
    return NextResponse.json({ error: 'Gagal menambah kategori' }, { status: 500 })
  }
}, { schema: kategoriSchema })
