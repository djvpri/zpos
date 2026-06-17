-- Migration: tambah kolom barcode ke tabel produk
ALTER TABLE produk ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_produk_barcode ON produk(toko_id, barcode) WHERE barcode IS NOT NULL;
