-- Migrasi: harga grosir & ecer per produk (dual pricing minimarket).
-- Jalankan MANUAL via psql/node postgres.js (tidak auto-run di build).
--
-- Menambahkan:
--   produk.harga_grosir    nullable numeric — harga satuan saat qty grosir aktif
--   produk.min_qty_grosir  nullable int     — ambang qty agar otomatis pakai harga_grosir
--
-- NULL pada kedua kolom = produk TIDAK punya harga grosir (ecer saja),
-- konsisten dengan perlakuan "tidak ada data".

ALTER TABLE produk
  ADD COLUMN IF NOT EXISTS harga_grosir NUMERIC,
  ADD COLUMN IF NOT EXISTS min_qty_grosir INTEGER;

-- Indeks bantu untuk laporan/filter bila perlu dicari produk yang punya harga grosir.
CREATE INDEX IF NOT EXISTS idx_produk_grosir ON produk (toko_id)
  WHERE harga_grosir IS NOT NULL;

COMMENT ON COLUMN produk.harga_grosir IS 'Harga satuan saat pembelian qty grosir (aktif bila qty >= min_qty_grosir). NULL = tidak ada harga grosir.';
COMMENT ON COLUMN produk.min_qty_grosir IS 'Jumlah minimum agar otomatis memakai harga_grosir. NULL = tidak ada ambang.';
