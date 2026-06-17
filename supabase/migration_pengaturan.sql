-- Migration: Pengaturan toko — pajak konfigurabel (default mati)
-- Jalankan via: psql $DATABASE_URL -f migration_pengaturan.sql

ALTER TABLE toko ADD COLUMN IF NOT EXISTS pajak_persen integer NOT NULL DEFAULT 0;
