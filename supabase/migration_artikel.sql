-- Artikel harian otomatis (landing ZPos).
-- Global, bukan per-toko (pola barcode_katalog).
-- Jalankan: psql $DATABASE_URL -f supabase/migration_artikel.sql
CREATE TABLE IF NOT EXISTS artikel (
  id            SERIAL PRIMARY KEY,
  judul         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  deskripsi     TEXT,
  tags          TEXT[] DEFAULT '{}',
  konten        TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_artikel_published_at ON artikel (published_at DESC);
