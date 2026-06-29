import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT id, nama FROM kategori WHERE toko_id = ${toko.tokoId} ORDER BY id`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { nama } = await req.json()
  if (!nama?.trim()) return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 })

  const existing = await sql`
    SELECT id FROM kategori WHERE toko_id = ${toko.tokoId} AND lower(nama) = lower(${nama.trim()})
  `
  if (existing.length > 0) return NextResponse.json({ error: 'Kategori sudah ada' }, { status: 400 })

  try {
    const [row] = await sql`
      INSERT INTO kategori (nama, toko_id) VALUES (${nama.trim()}, ${toko.tokoId}) RETURNING id, nama
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e: unknown) {
    // 23505 = unique_violation (mis. constraint unik global lama pada nama)
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'Nama kategori sudah dipakai' }, { status: 400 })
    }
    console.error('kategori POST error', e)
    return NextResponse.json({ error: 'Gagal menambah kategori' }, { status: 500 })
  }
}
