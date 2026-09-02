-- Z1Pos: Auto-upload log error z1 kasir (diagnosa remote).
-- Tiap tenant & tiap PC yang pakai z1 kasir: saat file zpos-errors.log bertambah,
-- kasir posting delta baris error/info ke server. Simpan per toko+device+timestamp
-- supaya bisa direview (retensi 12 jam).
-- Idempotent (pola seperti migrasi lain).

CREATE TABLE IF NOT EXISTS log_kasir (
  id          serial PRIMARY KEY,
  toko_id     int NOT NULL REFERENCES toko(id),
  device_id   text NOT NULL,                 -- id stabil per-install kasir (UUID)
  nama_pc     text,                          -- hostname device utk bedain PC
  konten      text NOT NULL DEFAULT '',      -- baris error/info yang baru (delta)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_log_kasir_toko_time ON log_kasir(toko_id, created_at);
CREATE INDEX IF NOT EXISTS idx_log_kasir_device ON log_kasir(device_id);
