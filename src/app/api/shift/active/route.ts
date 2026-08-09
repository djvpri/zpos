import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// GET: shift aktif. Default milik user token; kasir Tauri (token admin) kirim
// `?user_id=` utk cek shift aktif kasir lokal tertentu (admin-only).
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  let targetUserId = toko.userId
  const qUser = searchParams.get('user_id')
  if (qUser) {
    if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    targetUserId = Number(qUser)
  }

  const [shift] = await sql`
    SELECT id, nomor_shift, kasir_nama, modal_awal, buka_at
    FROM shift
    WHERE toko_id = ${toko.tokoId} AND user_id = ${targetUserId} AND aktif = true
    LIMIT 1
  `
  return NextResponse.json({ shift: shift ?? null })
}
