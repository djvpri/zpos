import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// PATCH /api/produk/duplikat/[id] — ubah status tinjauan pasangan:
//   { status: 'sama' | 'bukan' }
// 'sama' = admin konfirmasi dua produk itu duplikat; 'bukan' = false-positive.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const pid = Number(id)
  if (!Number.isFinite(pid)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

  let body: { status?: string } = {}
  try { body = await req.json() } catch { /* default */ }
  const status = body.status
  if (status !== 'sama' && status !== 'bukan') {
    return NextResponse.json({ error: 'status harus sama atau bukan' }, { status: 400 })
  }

  const [row] = await sql`
    UPDATE produk_duplikat SET status = ${status} WHERE id = ${pid} AND toko_id = ${auth.tokoId} RETURNING id
  `
  if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
