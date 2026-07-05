import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const staffId = parseInt(id)

  // Pastikan kasir ini milik toko yang sama dan bukan admin
  const [staff] = await sql`
    SELECT id FROM "user"
    WHERE id = ${staffId} AND toko_id = ${auth.tokoId} AND role = 'kasir'
  `
  if (!staff) return NextResponse.json({ error: 'Kasir tidak ditemukan' }, { status: 404 })

  await sql`DELETE FROM "user" WHERE id = ${staffId}`
  return NextResponse.json({ ok: true })
}
