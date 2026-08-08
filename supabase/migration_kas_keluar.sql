-- Migration: pengeluaran kas (kas keluar) per toko, opsional terikat shift kasir.
-- Saldo kas dihitung server: modal_awal + total_tunai − total_kas_keluar.
CREATE TABLE IF NOT EXISTS kas_keluar (
  id        SERIAL PRIMARY KEY,
  toko_id   INT NOT NULL REFERENCES toko(id),
  shift_id  INT REFERENCES shift(id),          -- NULL = input admin/umum (tak ada shift)
  user_id   INT REFERENCES "user"(id),         -- siapa yg catat
  kategori  VARCHAR(40) NOT NULL DEFAULT 'lainnya',
  nominal   INT NOT NULL CHECK (nominal > 0),
  catatan   TEXT,
  void      BOOLEAN NOT NULL DEFAULT false,    -- dibatalkan (void) → tak dihitung
  dibuat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kas_keluar_toko ON kas_keluar(toko_id);
CREATE INDEX IF NOT EXISTS idx_kas_keluar_shift ON kas_keluar(shift_id);
CREATE INDEX IF NOT EXISTS idx_kas_keluar_tgl ON kas_keluar(toko_id, dibuat_at DESC);
CREATE INDEX IF NOT EXISTS idx_kas_keluar_void ON kas_keluar(toko_id, void) WHERE void = false;
