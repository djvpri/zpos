import sql from './db'

// Katalog barcode pusat (global, lintas toko). Lihat supabase/migration_barcode_katalog.sql.
//
// Dua fungsi:
//   - cariBarcode(barcode)  → ambil nama/merek/kategori utk auto-fill saat kasir input produk.
//   - catatBarcodeDipakai() → belajar otomatis: setiap produk baru yang di-input ke ZPos
//     memperkaya/serefresh entri katalog supaya data terus tumbuh.

export interface KatalogSugesti {
  barcode: string
  nama: string | null
  merek: string | null
  kategori: string | null
}

/** Ambil satu entri katalog berdasar barcode. null kalau tak dikenal. */
export async function cariBarcode(barcode: string): Promise<KatalogSugesti | null> {
  const [row] = await sql`
    SELECT barcode, nama, merek, kategori
    FROM barcode_katalog
    WHERE barcode = ${barcode.trim()}
    LIMIT 1
  `
  if (!row) return null
  return {
    barcode: row.barcode,
    nama: row.nama || null,
    merek: row.merek || null,
    kategori: row.kategori || null,
  }
}

/**
 * Belajar otomatis saat produk baru disimpan. Fire-and-forget: gagal menulis
 * katalog TIDAK pernah menggagalkan simpan produk.
 *
 * - barcode & nama & (opsional merek/kategori) → UPSERT: kalau baru insert
 *   dengan hits=1; kalau sudah ada, update nama/merek terbaru + hits+1.
 * - Barcode menyala sumber relevansi: `dipakai_at` dipakai utk ranking masa depan.
 */
export async function catatBarcode(
  data: { barcode: string; nama: string; merek?: string | null; kategori?: string | null },
): Promise<void> {
  const bc = (data.barcode || '').trim()
  if (!bc || !data.nama || !data.nama.trim()) return
  try {
    await sql`
      INSERT INTO barcode_katalog (barcode, nama, merek, kategori, hits, dipakai_at)
      VALUES (${bc}, ${data.nama.trim().slice(0, 200)}, ${data.merek?.trim() || null},
              ${data.kategori?.trim() || null}, 1, now())
      ON CONFLICT (barcode) DO UPDATE SET
        nama    = EXCLUDED.nama,
        merek   = COALESCE(EXCLUDED.merek, barcode_katalog.merek),
        kategori= COALESCE(EXCLUDED.kategori, barcode_katalog.kategori),
        hits    = barcode_katalog.hits + 1,
        dipakai_at = now()
    `
  } catch (e) {
    // Fire-and-forget — log tak boleh mengganggu aksi utama.
    console.error('[barcode-katalog] gagal catat', bc, e)
  }
}
