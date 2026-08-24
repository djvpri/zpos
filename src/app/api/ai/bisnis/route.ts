import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'
import { analisaBisnis, RingkasanBisnis } from '@/lib/gemini-bisnis'

// Analisis AI atas transaksi toko (30 hari). Admin saja. GEMINI_API_KEY
// hanya dipakai server (di lib gemini-bisnis) — tak pernah ke browser.
//
// Batasan: SETIAP TOKO 1x ANALISIS PER HARI (waktu server UTC). Alasan:
//  - hemat biaya Gemini (jangan panggil berulang tiap refresh)
//  - hasil sebelumnya disimpan di tabel `ai_analisis` & bisa ditampilkan
//    lagi; klik berikutnya di hari sama mengembalikan hasil tsb, dan riwayat
//    harian tersimpan utk dilihat user.
// Reset tiap 00:00 UTC (= 07:00 WIB), ikut zona waktu server.
//
// `ponytail: filter harian pakai CURRENT_DATE UTC`. Kalau toko butuh batas
// zona lokal (per toko), tambah kolom `timezone` di toko & ganti filter.

const HARI = 30

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_analisis (
      id        serial PRIMARY KEY,
      toko_id   integer NOT NULL,
      user_id   integer,
      arahan    text NOT NULL,
      ringkasan jsonb,
      dibuat    timestamptz NOT NULL DEFAULT now()
    )`
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_analisis_toko ON ai_analisis (toko_id, dibuat DESC)`
}

export async function GET(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await ensureTable()

    // Sudah analisis hari ini? Kembalikan tanpa memanggil Gemini.
    const [hariIni] = await sql`
      SELECT id, arahan, ringkasan
      FROM ai_analisis
      WHERE toko_id = ${auth.tokoId}
        AND dibuat::date = CURRENT_DATE
      ORDER BY dibuat DESC
      LIMIT 1`

    if (hariIni) {
      return NextResponse.json({
        arahan: hariIni.arahan,
        ringkasan: hariIni.ringkasan,
        sudah: true,
      })
    }

    const since = new Date(Date.now() - HARI * 24 * 60 * 60 * 1000)

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
      // Jangan simpan error — biarkan retry lain kali.
      return NextResponse.json(hasil, { status: 502 })
    }

    await sql`
      INSERT INTO ai_analisis (toko_id, user_id, arahan, ringkasan)
      VALUES (${auth.tokoId}, ${auth.userId ?? null}, ${hasil.arahan}, ${sql.json(JSON.stringify(ringkasan))})`

    void catatAktivitas(auth, 'ai_bisnis', `Analisis AI bisnis (30 hari): ${jumlahTransaksi} trx`)
    return NextResponse.json({ arahan: hasil.arahan, ringkasan, sudah: false })
  } catch (e) {
    console.error('ai/bisnis error', e)
    return NextResponse.json({ arahan: '', error: 'Gagal memuat analisis. Coba lagi.' }, { status: 500 })
  }
}
