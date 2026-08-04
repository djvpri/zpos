-- Migration: kolom kasir_pin_hash utk login PIN offline (ZPos Kasir / desktop)
-- Jalankan via: node script pakai postgres.js, atau psql $DATABASE_URL.
--
-- Dua jalur pengisian (kombo):
--   1. OTOMATIS — POST /api/auth/kasir-setup saat owner setup app kasir:
--      utk user aktif yg belum punya PIN -> generate '0000<id>' (6 digit,
--      padStart 6) lalu bcrypt hash & simpan di sini.
--   2. MANUAL — admin ubah via /api/staff/[id] (PIN di-hash bcrypt, diset
--      admin lewat UI staff; ditarik desktop saat sync).
--
-- Nullable: user boleh tak punya PIN sampai pernah ditarik app / diset admin.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS kasir_pin_hash TEXT;
