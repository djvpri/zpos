-- Migration: Langganan & masa aktif toko
-- Jalankan via: psql $DATABASE_URL -f migration_langganan.sql

-- Tanggal langganan berakhir. NULL diperlakukan sebagai "tak terbatas".
ALTER TABLE toko ADD COLUMN IF NOT EXISTS langganan_sampai timestamptz;

-- Backfill: toko lama dapat masa trial 30 hari dari tanggal daftar.
UPDATE toko
SET langganan_sampai = created_at + interval '30 days'
WHERE langganan_sampai IS NULL;
