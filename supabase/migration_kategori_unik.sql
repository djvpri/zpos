-- Migration: Perbaiki unique constraint kategori agar per-toko (bukan global)
-- Masalah: schema awal membuat kategori.nama UNIQUE global, sehingga dua toko
-- tidak bisa punya kategori bernama sama → INSERT melempar error 23505.
-- Jalankan via: psql $DATABASE_URL -f migration_kategori_unik.sql

-- Hapus unique global lama (nama constraint default Postgres).
ALTER TABLE kategori DROP CONSTRAINT IF EXISTS kategori_nama_key;

-- Unik per toko (boleh nama sama di toko berbeda).
ALTER TABLE kategori ADD CONSTRAINT kategori_toko_nama_unik UNIQUE (toko_id, nama);
