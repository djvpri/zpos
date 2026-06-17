-- Migration: tambah kolom deskripsi ke tabel produk
ALTER TABLE produk ADD COLUMN IF NOT EXISTS deskripsi TEXT;
