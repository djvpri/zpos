-- Migration: Dukungan akun demo
-- Jalankan via: psql $DATABASE_URL -f migration_demo.sql

-- Desain akhir: SATU akun demo (demo@zomet.my.id) dipakai bersama semua
-- pengunjung, direset ke kondisi bersih 1x/hari lewat Railway Cron Job
-- (bukan per-pengunjung dengan expiry masing-masing seperti rancangan
-- awal — demo_expires_at di bawah ini SENGAJA DIBIARKAN ADA di skema
-- tapi TIDAK DIPAKAI lagi di kode, supaya tidak perlu migrasi ulang kalau
-- kolom itu memang sudah pernah dibuat sebelumnya. Aman diabaikan.
ALTER TABLE toko ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE toko ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;

-- SETELAH akun demo@zomet.my.id dibuat lewat Z One (register normal +
-- kasih akses ZPOS lewat /manage seperti user lain), tandai toko-nya
-- sebagai demo dengan query manual berikut (ganti email kalau berbeda):
--
--   UPDATE toko SET is_demo = true
--   WHERE id = (SELECT toko_id FROM "user" WHERE email = 'demo@zomet.my.id');
