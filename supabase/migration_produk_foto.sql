-- Migration: tambah kolom foto_url ke tabel produk
ALTER TABLE produk ADD COLUMN IF NOT EXISTS foto_url TEXT;
