import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// GET: shift aktif milik user saat ini
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [shift] = await sql`
    SELECT id, kasir_nama, modal_awal, buka_at
    FROM shift
    WHERE toko_id = ${toko.tokoId} AND user_id = ${toko.userId} AND aktif = true
    LIMIT 1
  `
  return NextResponse.json({ shift: shift ?? null })
}
