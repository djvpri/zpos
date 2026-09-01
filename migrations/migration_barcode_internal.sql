-- Zpos: barcode internal pendek (6 digit v3) utk label kecil 25mm.
-- Idempotent — aman dijalankan berulang (pola ALTER ... IF NOT EXISTS seperti server).
--
-- Produk ber-barcode panjang (EAN-13 asli 13 digit / internal lama v1 13-digit /
-- v2 8-digit) tetap menyimpan aslinya di kolom `barcode`. Kolom ini menampung
-- barcode internal PENDEK 6-digit (v3, generateProductBarcode(id)) yang dicetak
-- di label 25mm supaya terbaca scanner. Hanya di-backfill bila kosong.
ALTER TABLE produk ADD COLUMN IF NOT EXISTS barcode_internal text;
