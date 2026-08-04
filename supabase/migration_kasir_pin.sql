-- Migration: kolom kasir_pin_hash untuk login PIN 6 angka di kasir desktop.
-- PIN di-hash bcrypt, diset admin via /api/staff/[id], ditarik desktop saat sync.
-- Jalankan via node script pakai postgres.js (psql TIDAK terinstall di MSYS).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS kasir_pin_hash TEXT;
