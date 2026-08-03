import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { stockOpnameBuatSchema } from '@/lib/validation'
import { noSoBerikutnya, scopeToString, parseScope, produkDalamScope } from '@/lib/stock-opname'
import { catatAktivitas } from '@/lib/aktivitas'

// POST /api/stock-opname — buka sesi SO baru. Online-only: snapshot stok_sistem
// diambil LIVE dari DB (keputusan user — kasir butuh stok terkini saat scan).
export const POST = apiHandler(
  async (req, body: { nama?: string; scope?: 'semua' | 'kategori'; kategori_id?: number | null }) => {
    const toko = await getTokoFromRequest(req)
    if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Validasi scope kategori: kategori harus milik toko ini.
    const scope = parseScope(
      body.scope === 'kategori' && body.kategori_id ? `kategori:${body.kategori_id}` : body.scope,
    )
    if (scope.mode === 'kategori' && scope.kategoriId) {
      const [kat] = await sql`SELECT id FROM kategori WHERE id = ${scope.kategoriId} AND toko_id = ${toko.tokoId}`
      if (!kat) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 400 })
    }

    const nomor = await noSoBerikutnya(toko.tokoId)
    const [sesi] = await sql`
      INSERT INTO stock_opname (nomor_so, toko_id, nama, scope, dibuat_oleh)
      VALUES (${nomor}, ${toko.tokoId}, ${(body.nama ?? '').trim()}, ${scopeToString(scope)}, ${toko.userName ?? null})
      RETURNING id, nomor_so, nama, scope, status, dibuat_at
    `

    // Snapshot stok_sistem tiap produk dalam cakupan pas buka sesi (biar konsisten).
    const produk = await produkDalamScope(toko.tokoId, scope)
    for (const p of produk) {
      const [stok] = await sql`SELECT stok FROM produk WHERE id = ${p.produk_id}`
      await sql`
        INSERT INTO stock_opname_detail (so_id, produk_id, nama, barcode, kategori_id, stok_sistem)
        VALUES (${sesi.id}, ${p.produk_id}, ${p.nama}, ${p.barcode}, ${p.kategori_id}, ${stok?.stok ?? 0})
      `
    }
    await sql`UPDATE stock_opname SET jumlah_baris = ${produk.length} WHERE id = ${sesi.id}`

    catatAktivitas(toko, 'so_buat', `Buka ${nomor} cakupan ${scopeToString(scope)}`)
    return NextResponse.json(sesi, { status: 201 })
  },
  { schema: stockOpnameBuatSchema },
)

// GET /api/stock-opname — riwayat sesi SO toko ini (dengan ringkasan selisih).
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT s.id, s.nomor_so, s.nama, s.scope, s.status, s.jumlah_baris, s.dibuat_oleh,
           s.dibuat_at, s.selesai_at, s.disetujui_at,
           COALESCE(SUM(d.selisih), 0) AS total_selisih,
           COALESCE(SUM(CASE WHEN d.selisih != 0 THEN 1 ELSE 0 END), 0) AS ada_selisih
    FROM stock_opname s
    LEFT JOIN stock_opname_detail d ON d.so_id = s.id
    WHERE s.toko_id = ${toko.tokoId}
    GROUP BY s.id
    ORDER BY s.dibuat_at DESC
    LIMIT 100
  `
  return NextResponse.json(rows)
}
