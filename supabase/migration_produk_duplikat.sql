-- Migration: deteksi foto produk mirip / berpotensi duplikat.
-- Hasil scan ZFace disimpan per pasangan; status dipakai utk aksi
-- (tandai 'sama' / 'bukan'). Dibersihkan otomatis bila salah satu produk dihapus.
CREATE TABLE IF NOT EXISTS produk_duplikat (
  id           SERIAL PRIMARY KEY,
  toko_id      INT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  produk_id_a  INT NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
  produk_id_b  INT NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
  skor         FLOAT NOT NULL,               -- confidence 0..1 dari ZFace
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sama','bukan')),
  dibuat_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- a & b selalu diurutkan (a < b) biar pasangan tak dobel (a,b) & (b,a)
  CHECK (produk_id_a < produk_id_b),
  UNIQUE (toko_id, produk_id_a, produk_id_b)
);

CREATE INDEX IF NOT EXISTS idx_duplikat_toko ON produk_duplikat(toko_id, status);
CREATE INDEX IF NOT EXISTS idx_duplikat_a ON produk_duplikat(produk_id_a);
CREATE INDEX IF NOT EXISTS idx_duplikat_b ON produk_duplikat(produk_id_b);
