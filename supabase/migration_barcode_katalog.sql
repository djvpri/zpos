-- Migration: Katalog barcode pusat (global, lintas toko)
--
-- "Kamus" barcode→nama/merek/kategori yang dipakai utk auto-suggest saat kasir
-- input produk baru. BUKAN produk milik toko mana pun — produk aktual tetap
-- per-toko. Data tumbuh otomatis: setiap produk baru yang di-input ke ZPos
-- ikut memperkaya tabel ini (lihat kolom `dipakai_at`).
--
-- Jalankan: node scripts/run_migration.cjs PATH_FILE ini  (atau psql)

CREATE TABLE IF NOT EXISTS barcode_katalog (
    barcode        text PRIMARY KEY,
    nama           text NOT NULL,
    merek          text,
    kategori       text,
    sumber         text NOT NULL DEFAULT 'input',   -- 'seed' | 'import' | 'input' | 'saran'
    hits           bigint NOT NULL DEFAULT 1,       -- berapa kali dipakai (untuk ranking)
    dipakai_at     timestamptz,                     -- kapan terakhir muncul di input produk
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Cari barcode yang sering muncul dalam input produk (untuk autocomplete / saran).
CREATE INDEX IF NOT EXISTS idx_barcode_katalog_nama
    ON barcode_katalog (LOWER(nama) text_pattern_ops);
