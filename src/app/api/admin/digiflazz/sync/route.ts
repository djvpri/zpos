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

  try {
    let scope: 'all' | 'demo' = 'all'
    try { scope = (await req.json().catch(() => ({}))).scope === 'demo' ? 'demo' : 'all' } catch { /* body kosong */ }

    // Pakai cache price-list (SEGAR bila owner baru tekan "Segarkan Harga" di halaman).
    // JANGAN paksa refresh lagi di sini: dua panggilan fresh berdekatan kena "limitasi
    // pengecekan pricelist" Digiflazz dan balikin data kosong → materialisasi 0 SKU.
    // Alur sehat: owner "Segarkan Harga" sekali (fresh → cache) → baru klik sinkron.
    const { prepaid, pasca } = await priceList()
    const res = await syncSemua(prepaid, pasca, scope)
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    // 1) Log lengkap di server (Coolify "Logs" container) utk investigasi —
    //    stack penuh, bukan cuma satu baris.
    console.error('[sync-digital] sync gagal:', e)
    // 2) Kirim detail ke UI owner supaya penyebab terlihat di Harga Pulsa
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
