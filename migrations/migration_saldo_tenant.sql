-- Z1Pos: Sistem Saldo Tenant + Margin Owner (jual pulsa via Digiflazz)
-- Model: tenant top-up deposit ke owner; owner top-up ke Digiflazz.
-- Saat tenant jual pulsa, server DEBIT saldo_toko = modal + margin_owner.
-- margin_owner persen(%) ATAU nominal(Rp) terhadap modal, diset owner per produk digital.
-- Idempotent (pola ALTER ... IF NOT EXISTS seperti migrasi lain).

-- 1. Toko: saldo deposit (uang muka tenant utk beli pulsa).
ALTER TABLE toko ADD COLUMN IF NOT EXISTS saldo int NOT NULL DEFAULT 0;

-- 2. Produk digital: margin owner.
ALTER TABLE produk ADD COLUMN IF NOT EXISTS margin_type text DEFAULT 'persen'; -- 'persen' | 'nominal'
ALTER TABLE produk ADD COLUMN IF NOT EXISTS margin_persen int;                 -- utk persen: % tambahan thd modal
ALTER TABLE produk ADD COLUMN IF NOT EXISTS margin_nominal int;                -- utk nominal: Rp tetap tambahan thd modal

-- 3. Riwayat mutasi saldo tenant.
CREATE TABLE IF NOT EXISTS toko_deposit (
  id          serial PRIMARY KEY,
  toko_id     int NOT NULL REFERENCES toko(id),
  nominal     int NOT NULL,                       -- jumlah uang (selalu POSITIF); arah pakai tipe
  tipe        text NOT NULL,                      -- 'topup' | 'debit' | 'refund' | 'adjust' (topup/refund/adjust bisa +/− saldo)
  keterangan  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_toko_deposit_toko ON toko_deposit(toko_id);

-- 4. Transaksi digital: simpan harga_debet (modal+margin) utk laporan margin owner.
ALTER TABLE transaksi_digital ADD COLUMN IF NOT EXISTS harga_debet int;  -- beda modal (harga Digiflazz) vs harga_debet (ditarik dari saldo tenant)
