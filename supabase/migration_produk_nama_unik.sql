-- Nama produk TIDAK boleh sama dalam satu toko (case-insensitive).
-- Ekspresi dari LOWER(nama) supaya "Sepatu" dan "sepatu" dianggap duplikat.
-- Jalankan manual: psql "DATABASE_URL" -f supabase/migration_produk_nama_unik.sql
CREATE UNIQUE INDEX IF NOT EXISTS produk_toko_nama_unik
  ON produk (toko_id, LOWER(nama));
