-- =============================================
-- ZPOS Toko Online per tenant
-- Jalankan manual ke Railway: psql $DATABASE_URL -f supabase/migration_toko_online.sql
-- =============================================

-- Subdomain unik tenant (mis 'warung-bu-sari'). NULL = belum diatur.
ALTER TABLE toko ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

-- Toggle toko online aktif.
ALTER TABLE toko ADD COLUMN IF NOT EXISTS toko_online_aktif boolean DEFAULT false;

-- Nomor WhatsApp tujuan pesanan (format internasional tanpa '+', mis 628123456789).
ALTER TABLE toko ADD COLUMN IF NOT EXISTS wa_toko_online text;

-- Index lookup cepat by subdomain (case-insensitive subdomain jg dinormalisasi di app).
CREATE UNIQUE INDEX IF NOT EXISTS toko_subdomain_lower_unique
  ON toko (LOWER(subdomain))
  WHERE subdomain IS NOT NULL;
