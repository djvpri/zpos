import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'
import { analisaBisnis, RingkasanBisnis } from '@/lib/gemini-bisnis'

// Analisis AI atas transaksi toko (30 hari). Admin saja. GEMINI_API_KEY
// hanya dipakai server (di lib gemini-bisnis) — tak pernah ke browser.
// Cache hasil di memori 10 menit supaya tiap refresh tak memanggil Gemini
// berulang (biaya ~desimal rupiah/panggilan, tapi jangan boros).

const cache = new Map<number, { at: number; hasil: { arahan: string } | { arahan: string; error: string } }>()

// Ringkasan DB → hemat token buat prompt.
const HARI = 30

export async function GET(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Cache (memory, per toko) — TTL 10 menit.
  const now = Date.now()
  const c = cache.get(auth.tokoId)
  if (c && now - c.at < 10 * 60 * 1000) return NextResponse.json(c.hasil)

  const since = new Date(Date.now() - HARI * 24 * 60 * 60 * 1000)

  try {
    const [agregat] = await sql`
      SELECT
        COUNT(*)::int AS jumlah_transaksi,
        COALESCE(SUM(total), 0) AS total_penjualan
      FROM transaksi
      WHERE toko_id = ${auth.tokoId} AND created_at >= ${since}`
    const jumlahTransaksi: number = agregat?.jumlah_transaksi ?? 0
    const totalPenjualan: number = Number(agregat?.total_penjualan ?? 0)

    // Produk terlaris 30 hari (qty & omzet dari detail_transaksi).
    const produkTerlaris = await sql`
      SELECT nama_produk, SUM(qty)::int AS qty, SUM(subtotal) AS total
      FROM detail_transaksi
      WHERE toko_id = ${auth.tokoId} AND created_at >= ${since}
        AND produk_id IS NOT NULL AND produk_id > 0
      GROUP BY nama_produk
      ORDER BY SUM(qty) DESC
      LIMIT 5`

    // Produk laku tapi stok menipis (risiko kehabisan): stok kecil vs terjual.
    const stokMenipis = await sql`
      SELECT p.nama, p.stok::int AS stok, COALESCE(j.qty, 0)::int AS qty
      FROM produk p
      LEFT JOIN (
        SELECT produk_id, SUM(qty) AS qty
        FROM detail_transaksi
        WHERE toko_id = ${auth.tokoId} AND created_at >= ${since}
        GROUP BY produk_id
      ) j ON j.produk_id = p.id
      WHERE p.toko_id = ${auth.tokoId} AND p.stok <= 5 AND COALESCE(j.qty, 0) > 0
      ORDER BY p.stok ASC
      LIMIT 5`

    // Produk tak laku sama sekali 30 hari (kandidat diskon/berhenti), masih ada stok.
    const takLaku = await sql`
      SELECT p.nama, p.stok::int AS stok
      FROM produk p
      LEFT JOIN (
        SELECT DISTINCT produk_id FROM detail_transaksi
        WHERE toko_id = ${auth.tokoId} AND created_at >= ${since}
      ) j ON j.produk_id = p.id
      WHERE p.toko_id = ${auth.tokoId} AND j.produk_id IS NULL AND p.stok > 0
      ORDER BY p.stok DESC
      LIMIT 5`

    // Jam sibuk per hari (total transaksi per jam).
    const jamSibuk = await sql`
      SELECT EXTRACT(HOUR FROM created_at)::int AS jam, COUNT(*)::int AS jual
      FROM transaksi
      WHERE toko_id = ${auth.tokoId} AND created_at >= ${since}
      GROUP BY jam
      ORDER BY jual DESC
      LIMIT 3`

    const ringkasan: RingkasanBisnis = {
      jumlahTransaksi,
      totalPenjualan,
      produkTerlaris: produkTerlaris.map(p => ({
        nama: p.nama_produk,
        qty: Number(p.qty),
        total: Number(p.total),
      })),
      stokMenipis: stokMenipis.map(p => ({ nama: p.nama, stok: Number(p.stok), qty: Number(p.qty) })),
      takLaku: takLaku.map(p => ({ nama: p.nama, stok: Number(p.stok) })),
      jamSibuk: jamSibuk.map(j => ({ jam: Number(j.jam), jual: Number(j.jual) })),
    }

    const hasil = await analisaBisnis(ringkasan)

    if (hasil.error) {
      // Jangan cache error — biarkan retry lain kali.
      return NextResponse.json(hasil, { status: 502 })
    }

    cache.set(auth.tokoId, { at: now, hasil })
    void catatAktivitas(auth, 'ai_bisnis', `Analisis AI bisnis (30 hari): ${jumlahTransaksi} trx, ${HARI} hari`)
    return NextResponse.json({ arahan: hasil.arahan })
  } catch (e) {
    console.error('ai/bisnis error', e)
    return NextResponse.json({ arahan: '', error: 'Gagal memuat analisis. Coba lagi.' }, { status: 500 })
  }
}
