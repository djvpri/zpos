import sql from '@/lib/db'
import type { PricelistItem } from '@/lib/digiflazz'

// Pustaka/master SKU Digiflazz + materialisasi item pulsa ke SEMUA toko.
// Konsep (fase-2 produk digital):
//   - `digital_sku` = master global SKU Digiflazz (nama, category, harga_modal,
//     digital_brand, margin master, aktif).
//   - materialisasi = jadikan tiap SKU sebagai ROW `produk` (jenis='digital')
//     di tiap toko, supaya kasir web + desktop(Tauri sync ?semua=1) menampilkan
//     otomatis tanpa rombak besar. Harga jual default = harga_modal + margin,
//     tenant tinggal ubah row produk-nya (harga/aktif) utk menyesuaikan.

export interface SyncDigitalResult {
  dibuat: number
  duplikat: number
  sku: number
  toko: number
  perlu_migrasi?: boolean // true bila tabel master digital_sku belum ada di DB
}

// Cek apakah tabel master digital_sku sudah ada di DB (migrasi migration_digital_sku.sql).
// Ini agar kode tetap berjalan aman bila migrasi belum diterapkan (utk urutan deploy).
async function punyaMaster(): Promise<boolean> {
  const [r] = await sql`SELECT to_regclass('public.digital_sku') IS NOT NULL AS ok`
  return !!r?.ok
}

// Buat tabel master bila blm ada (mirror migration_digital_sku.sql, idempotent).
// Dipanggil hanya saat owner eksplisit via tombol sync Harga Pulsa — skema
// digital_sku add-only, non-breaking buat tenant yg sedang pakai.
async function pastikanMaster(): Promise<boolean> {
  if (await punyaMaster()) return true
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS digital_sku (
        buyer_sku_code   text PRIMARY KEY,
        product_name     text NOT NULL,
        category         text,
        brand            text,
        harga_modal      int  DEFAULT 0,
        digital_brand    text DEFAULT 'prabayar',
        margin_type      text,
        margin_persen    int,
        margin_nominal   int,
        aktif            boolean NOT NULL DEFAULT true,
        updated_at       timestamptz NOT NULL DEFAULT now()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_digital_sku_aktif ON digital_sku(aktif)`
    return true
  } catch {
    return false // DB kita terlarang DDL? -> tanda utk UI
  }
}

// Upsert master SKU dari hasil price-list Digiflazz. Idempotent by buyer_sku_code.
// Refresh hanya memperbarui data harga Digiflazz (modal/nama/kategori/brand),
// TIDAK menyentuh margin_yang sudah diset owner (margin master authoritative).
async function upsertMaster(items: PricelistItem[], digitalBrand: 'prabayar' | 'pasca') {
  for (const it of items) {
    await sql`
      INSERT INTO digital_sku (buyer_sku_code, product_name, category, brand, harga_modal, digital_brand, updated_at)
      VALUES (${it.buyer_sku_code}, ${it.product_name}, ${it.category || null}, ${it.brand || null},
              ${Math.round(Number(it.price) || 0)}, ${digitalBrand}, now())
      ON CONFLICT (buyer_sku_code) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        category = EXCLUDED.category,
        brand = EXCLUDED.brand,
        harga_modal = EXCLUDED.harga_modal,
        updated_at = now()
    `
  }
}

// Set margin GLOBAL satu SKU: master authoritative + disebar ke SEMUA row produk
// digital SKU tsb (semua toko yang sudah punya row). Dipakai endpoint margin.
// Master di-update hanya bila tabelnya sudah ada (migrasi diterapkan); kalau
// belum, operasi tetap berfungsi utk row produk (kompat mode lama).
export async function setMarginSku(buyerSkuCode: string, marginType: 'persen' | 'nominal' | null, marginPersen: number | null, marginNominal: number | null) {
  if (await punyaMaster()) {
    await sql`
      INSERT INTO digital_sku (buyer_sku_code, product_name, digital_brand, margin_type, margin_persen, margin_nominal)
      VALUES (${buyerSkuCode}, '', 'prabayar', ${marginType}, ${marginPersen}, ${marginNominal})
      ON CONFLICT (buyer_sku_code) DO UPDATE SET
        margin_type = EXCLUDED.margin_type,
        margin_persen = EXCLUDED.margin_persen,
        margin_nominal = EXCLUDED.margin_nominal,
        updated_at = now()
    `
  }
  // sebarkan ke row produk milik semua toko yg sudah punya
  const upd = await sql`
    UPDATE produk SET margin_type = ${marginType}, margin_persen = ${marginPersen}, margin_nominal = ${marginNominal}
    WHERE jenis = 'digital' AND buyer_sku_code = ${buyerSkuCode}
  `
  return { updated: upd.length ?? 0 }
}

// Margin utk harga jual default (harga_modal + margin) dari master.
// Sebelum owner set margin, margin kosong → default harga jual = harga_modal.
function defaultHarga(modal: number, marginType: string | null, marginPersen: number | null, marginNominal: number | null): number {
  if (marginType === 'nominal' && marginNominal) return modal + marginNominal
  if (marginPersen) return modal + Math.round((modal * marginPersen) / 100)
  return modal
}

// Sync master + materialisasi SKU jadi produk di toko target. Idempotent:
//   - tambah row produk per (toko_id, buyer_sku_code) yang belum ada
//   - sinkron harga_modal margin utk SKU yang berubah di master (row aktif)
// scope 'all' (default) = semua toko aktif; 'demo' = hanya tenant demo (is_demo)
// supaya bisa uji dulu di satu toko demo tanpa merusak toko asli.
// Row produk utk toko tertentu boleh dinonaktifkan sendiri oleh tenant;
// fungsi ini tidak menghapus / meng-aktifkan ulang yang tenant matikan.
export async function syncSemua(
  itemsPrabayar: PricelistItem[],
  itemsPasca: PricelistItem[],
  scope: 'all' | 'demo' = 'all',
): Promise<SyncDigitalResult> {
  // Kalau tabel master blm ada, buat otomatis (add-only, aman utk tenant) lalu lanjut.
  // Kalau DDL gagal (tak punya hak), tandai buat UI.
  if (!(await pastikanMaster())) {
    return { dibuat: 0, duplikat: 0, sku: 0, toko: 0, perlu_migrasi: true }
  }
  // 1. Update master
  await upsertMaster(itemsPrabayar, 'prabayar')
  await upsertMaster(itemsPasca, 'pasca')

  // Master SKU utk dipakai (hanya yg aktif default)
  const aktif = (await sql`
    SELECT buyer_sku_code, product_name, category, brand, harga_modal, digital_brand,
           margin_type, margin_persen, margin_nominal, aktif
    FROM digital_sku
  `) as Array<{
    buyer_sku_code: string; product_name: string; category: string | null; brand: string | null
    harga_modal: number; digital_brand: string; margin_type: string | null
    margin_persen: number | null; margin_nominal: number | null; aktif: boolean
  }>

  const semuaToko = (await sql`SELECT id FROM toko WHERE aktif = true ${scope === 'demo' ? sql`AND is_demo = true` : sql``}`) as Array<{ id: number }>
  const hasil: SyncDigitalResult = { dibuat: 0, duplikat: 0, sku: aktif.length, toko: semuaToko.length }

  for (const sku of aktif) {
    const hargaJual = defaultHarga(sku.harga_modal || 0, sku.margin_type, sku.margin_persen, sku.margin_nominal)
    for (const tk of semuaToko) {
      // cek ada: (row jenis digital milik toko ini dgn sku sama)
      const [ada] = await sql`
        SELECT id, harga_modal FROM produk
        WHERE toko_id = ${tk.id} AND jenis = 'digital' AND buyer_sku_code = ${sku.buyer_sku_code}
        LIMIT 1
      `
      if (ada) {
        // sinkron harga_modal (kalau berubah pricelist). Margin utk row yang
        // sudah-SKU diterapkan lagi HANYA dari master ketika master punya nilai
        // (authoritative); jangan kehapus margin lama yg diset sebelum master ada.
        const upd = sku.margin_type
          ? sql`UPDATE produk SET modal = ${sku.harga_modal || 0},
                 margin_type = ${sku.margin_type}, margin_persen = ${sku.margin_persen}, margin_nominal = ${sku.margin_nominal},
                 updated_at = now() WHERE id = ${ada.id}`
          : sql`UPDATE produk SET modal = ${sku.harga_modal || 0}, updated_at = now() WHERE id = ${ada.id}`
        await upd
        hasil.duplikat++
      } else {
        // Materialisasi SKU baru utk toko ini (margin ikut master bila diset)
        await sql`
          INSERT INTO produk (nama, harga, stok, emoji, foto_url, kategori_id, toko_id, stok_minimum,
                              jenis, buyer_sku_code, modal, digital_brand, aktif,
                              margin_type, margin_persen, margin_nominal)
          VALUES (${sku.product_name}, ${hargaJual}, 0, ${sku.brand ? '⚡' : null}, NULL, NULL, ${tk.id}, 5,
                  'digital', ${sku.buyer_sku_code}, ${sku.harga_modal || 0}, ${sku.digital_brand}, true,
                  ${sku.margin_type}, ${sku.margin_persen}, ${sku.margin_nominal})
        `
        hasil.dibuat++
      }
    }
  }
  return hasil
}
