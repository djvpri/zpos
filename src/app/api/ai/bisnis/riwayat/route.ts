import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Riwayat analisis AI toko — 10 terakhir, terbaru dulu. Admin saja.
// Data dari tabel `ai_analisis` (diisi route /api/ai/bisnis).

export async function GET(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const riwayat = await sql`
      SELECT id, arahan, ringkasan, dibuat
      FROM ai_analisis
      WHERE toko_id = ${auth.tokoId}
      ORDER BY dibuat DESC
      LIMIT 10`
    return NextResponse.json({ riwayat })
  } catch (e) {
    console.error('ai/riwayat error', e)
    return NextResponse.json({ riwayat: [] })
  }
}
