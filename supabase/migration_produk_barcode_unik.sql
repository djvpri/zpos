-- =============================================
-- Migration: Barcode unik per-toko (anti-duplikat)
-- Proteksi struktural di level database supaya satu toko tidak punya dua
-- produk dengan barcode yang sama. Index ini PARTIAL → mengizinkan banyak
-- NULL (produk tanpa barcode) tapi menolak barcode duplikat dalam satu toko.
--
-- Jalankan via: psql $DATABASE_URL -f migration_produk_barcode_unik.sql
-- =============================================

-- 1. Bersihkan duplikat yang mungkin sudah ada (kalau ada) SUPAYA create index
--    tidak gagal. Produk yang kena dedupe di-inaktifkan (aktif = false) dan
--    barcode-nya dikosongkan — bukan dihapus, supaya riwayat transaksi yang
--    mereferensikannya tetap aman. Yang "disisakan" adalah produk dengan id
--    terkecil (paling lama).
UPDATE produk p
SET aktif = false, barcode = NULL
WHERE EXISTS (
  SELECT 1 FROM produk p2
  WHERE p2.toko_id = p.toko_id
    AND p2.barcode = p.barcode
    AND p2.barcode IS NOT NULL
    AND p2.id < p.id   -- sisakan id terkecil, nonaktifkan sisanya
);

-- 2. Hapus index non-unique lama (kalau ada).
DROP INDEX IF EXISTS idx_produk_barcode;

-- 3. Index partial UNIQUE: (toko_id, barcode) hanya untuk baris ber-barcode.
CREATE UNIQUE INDEX IF NOT EXISTS produk_toko_barcode_unik
  ON produk (toko_id, barcode)
  WHERE barcode IS NOT NULL;
