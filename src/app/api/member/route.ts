import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { memberSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

// GET daftar member toko. Query optional `cari` dipakai kasir utk lookup
// cepat (telepon/nama) saat pilih member. Zona per-toko + role aman.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cari = searchParams.get('cari')?.trim() ?? ''

  const rows = cari
    ? await sql`
        SELECT m.id, m.nama, m.telepon, m.kategori_member_id, m.created_at,
               k.nama AS kategori_nama, k.diskon_persen
        FROM member m
        LEFT JOIN kategori_member k ON k.id = m.kategori_member_id AND k.toko_id = m.toko_id
        WHERE m.toko_id = ${toko.tokoId}
          AND (m.telepon ILIKE ${'%' + cari + '%'} OR m.nama ILIKE ${'%' + cari + '%'})
        ORDER BY m.nama LIMIT 20
      `
    : await sql`
        SELECT m.id, m.nama, m.telepon, m.kategori_member_id, m.created_at,
               k.nama AS kategori_nama, k.diskon_persen
        FROM member m
        LEFT JOIN kategori_member k ON k.id = m.kategori_member_id AND k.toko_id = m.toko_id
        WHERE m.toko_id = ${toko.tokoId}
        ORDER BY m.nama
      `
  return NextResponse.json(rows)
}

// POST tambah member
export const POST = apiHandler(async (req: Request, body: { nama: string; telepon?: string | null; kategori_member_id?: number | null }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const kategoriId = body.kategori_member_id ?? null
  // Validasi kategori milik toko ini kalau diisi (cegah menautkan kategori toko lain)
  if (kategoriId) {
    const [kat] = await sql`SELECT id FROM kategori_member WHERE id = ${kategoriId} AND toko_id = ${toko.tokoId}`
    if (!kat) return NextResponse.json({ error: 'Kategori member tidak valid' }, { status: 400 })
  }

  const [row] = await sql`
    INSERT INTO member (nama, telepon, kategori_member_id, toko_id)
    VALUES (${body.nama.trim()}, ${body.telepon || null}, ${kategoriId}, ${toko.tokoId})
    RETURNING id, nama, telepon, kategori_member_id, created_at
  `
  return NextResponse.json(row, { status: 201 })
}, { schema: memberSchema })
