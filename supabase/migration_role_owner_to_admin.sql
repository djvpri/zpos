-- Migration: ganti role 'owner' -> 'admin'
-- ZPos hanya pakai dua role sekarang: 'kasir' dan 'admin' (owner dihapus).
-- Jalankan via: psql $DATABASE_URL -f migration_role_owner_to_admin.sql
--
-- Constraint lama dibuat inline di migration_user_roles.sql
-- (CHECK (role IN ('owner','kasir'))). Nama-nya di-generate Postgres otomatis
-- (biasanya "user_role_check"), jadi di sini kita cari & drop SEMUA check
-- constraint pada tabel "user" yang menyangkut kolom role, biar aman walau
-- namanya beda di DB-mu. Idempotent: aman dijalankan berulang.

BEGIN;

-- 1) Drop check constraint lama pada kolom role (apapun namanya)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = '"user"'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE "user" DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

-- 2) Konversi semua owner lama menjadi admin
UPDATE "user" SET role = 'admin' WHERE role = 'owner';

-- 3) Pasang constraint baru: hanya kasir & admin
ALTER TABLE "user" ADD CONSTRAINT user_role_check CHECK (role IN ('kasir', 'admin'));

COMMIT;
