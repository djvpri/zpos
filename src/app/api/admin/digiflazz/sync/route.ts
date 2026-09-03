import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { priceList } from '@/lib/digiflazz'
import { syncSemua } from '@/lib/sync-digital'

export const runtime = 'nodejs'

// Admin z1pos (owner): sinkronkan master Digiflazz & materialisasi SEMUA SKU
// menjadi row produk digital di setiap toko (aktif). Idempotent.
// Dipanggil manual via tombol di Harga Pulsa (bukan tiap refresh otomatis,
// supaya owner yang memutuskan kapan SKU baru "menyala" ke semua toko).
export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let scope: 'all' | 'demo' = 'all'
  try { scope = (await req.json().catch(() => ({}))).scope === 'demo' ? 'demo' : 'all' } catch { /* body kosong */ }

  const { prepaid, pasca } = await priceList(true) // paksa ambil harga Digiflazz terbaru
  const res = await syncSemua(prepaid, pasca, scope)
  return NextResponse.json({ ok: true, ...res })
}
