-- Migration: tambah info toko untuk header struk
ALTER TABLE toko ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE toko ADD COLUMN IF NOT EXISTS telepon VARCHAR(20);
ALTER TABLE toko ADD COLUMN IF NOT EXISTS catatan_struk TEXT;
