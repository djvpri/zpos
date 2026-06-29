-- Migration: ganti role 'owner' -> 'admin'
-- ZPos hanya pakai dua role sekarang: 'kasir' dan 'admin' (owner dihapus).
-- Jalankan via: psql $DATABASE_URL -f migration_role_owner_to_admin.sql
--
-- CATATAN: constraint lama dibuat inline di migration_user_roles.sql
-- (CHECK (role IN ('owner','kasir'))) sehingga Postgres memberi nama otomatis
-- "user_role_check". Kalau di DB-mu namanya beda, sesuaikan DROP CONSTRAINT-nya.

BEGIN;

-- 1) Lepas constraint lama supaya update data tidak ditolak
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_role_check;

-- 2) Konversi semua owner lama menjadi admin
UPDATE "user" SET role = 'admin' WHERE role = 'owner';

-- 3) Pasang constraint baru: hanya kasir & admin
ALTER TABLE "user" ADD CONSTRAINT user_role_check CHECK (role IN ('kasir', 'admin'));

COMMIT;
