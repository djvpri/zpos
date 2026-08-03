import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Hanya admin yang boleh melihat log (kasir tak boleh lihat jejak sesama kasir).
  if (toko.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)
  const kategori = searchParams.get('kategori')

  const where = kategori
    ? sql`WHERE toko_id = ${toko.tokoId} AND kategori = ${kategori}`
    : sql`WHERE toko_id = ${toko.tokoId}`

  const rows = await sql`
    SELECT * FROM log_aktivitas ${where} ORDER BY created_at DESC, id DESC LIMIT ${limit}
  `
  return NextResponse.json(rows)
}
