-- Migration: Dukungan tenant demo self-serve
-- Jalankan via: psql $DATABASE_URL -f migration_demo.sql

ALTER TABLE toko ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE toko ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;

-- Query cleanup (hapus demo yang sudah lewat waktu) butuh cari cepat
-- berdasarkan is_demo+demo_expires_at — partial index karena mayoritas
-- toko bukan demo, jadi index penuh cuma buang-buang tempat.
CREATE INDEX IF NOT EXISTS idx_toko_demo_expires ON toko (demo_expires_at) WHERE is_demo = true;
