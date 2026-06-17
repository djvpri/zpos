-- Migration: Pembatalan (void) transaksi
-- Jalankan via: psql $DATABASE_URL -f migration_void.sql

ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS dibatalkan boolean NOT NULL DEFAULT false;
