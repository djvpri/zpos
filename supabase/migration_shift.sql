-- Migration: rekap shift kasir
CREATE TABLE IF NOT EXISTS shift (
  id          SERIAL PRIMARY KEY,
  toko_id     INT NOT NULL REFERENCES toko(id),
  user_id     INT NOT NULL REFERENCES "user"(id),
  kasir_nama  VARCHAR(100) NOT NULL,
  modal_awal  INT NOT NULL DEFAULT 0,
  buka_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  tutup_at    TIMESTAMPTZ,
  aktif       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_shift_toko ON shift(toko_id);
CREATE INDEX IF NOT EXISTS idx_shift_aktif ON shift(toko_id, user_id, aktif) WHERE aktif = true;

-- Hubungkan transaksi ke shift
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES shift(id);
