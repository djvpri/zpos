-- =============================================
-- ZPOS Multi-tenant Migration
-- Jalankan di Railway PostgreSQL Console:
--   psql $DATABASE_URL
-- Lalu paste semua SQL ini
-- =============================================

-- 1. Buat tabel toko
CREATE TABLE IF NOT EXISTS toko (
  id serial PRIMARY KEY,
  nama text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  plan text DEFAULT 'trial',
  aktif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Hapus sample data lama (belum ada toko_id)
TRUNCATE detail_transaksi, transaksi, produk, kategori RESTART IDENTITY CASCADE;

-- 3. Tambah kolom toko_id ke semua tabel
ALTER TABLE kategori ADD COLUMN IF NOT EXISTS toko_id integer REFERENCES toko(id) ON DELETE CASCADE;
ALTER TABLE produk ADD COLUMN IF NOT EXISTS toko_id integer REFERENCES toko(id) ON DELETE CASCADE;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS toko_id integer REFERENCES toko(id) ON DELETE CASCADE;
ALTER TABLE detail_transaksi ADD COLUMN IF NOT EXISTS toko_id integer REFERENCES toko(id) ON DELETE CASCADE;

-- 4. Hapus view lama (query laporan sudah dihandle di API dengan filter toko_id)
DROP VIEW IF EXISTS v_laporan_harian;
DROP VIEW IF EXISTS v_produk_terlaris;

-- 5. Hapus RLS policies (auth sekarang via JWT, bukan Supabase RLS)
DROP POLICY IF EXISTS "allow all produk" ON produk;
DROP POLICY IF EXISTS "allow all transaksi" ON transaksi;
DROP POLICY IF EXISTS "allow all detail" ON detail_transaksi;
DROP POLICY IF EXISTS "allow all kategori" ON kategori;
