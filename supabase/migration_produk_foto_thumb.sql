-- Foto thumbnail kecil (base64 ~48px) untuk ditampilkan di grid kasir tanpa
-- membuat payload API besar. foto_url (besar, hingga ~100KB) tetap dipakai utk
-- detail/print/label/scan visual — TAPI tidak boleh dikirim semua di list kasir.
-- Jalankan manual ke Railway: psql "DATABASE_URL" -f supabase/migration_produk_foto_thumb.sql
ALTER TABLE produk ADD COLUMN IF NOT EXISTS foto_thumb TEXT;
