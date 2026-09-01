-- Z1Pos: fitur Item Digital (jual pulsa/tagihan via Digiflazz)
-- Idempotent — aman dijalankan berulang (pola ALTER ... IF NOT EXISTS seperti server).

-- 1. Produk: tandai item digital + kode Digiflazz + harga modal.
ALTER TABLE produk ADD COLUMN IF NOT EXISTS jenis text DEFAULT 'fisik';     -- 'fisik' | 'digital'
ALTER TABLE produk ADD COLUMN IF NOT EXISTS buyer_sku_code text;             -- kode Digiflazz (xld10, pln, pdam, ...)
ALTER TABLE produk ADD COLUMN IF NOT EXISTS modal int;                       -- harga dasar Digiflazz (buat hitung margin)
ALTER TABLE produk ADD COLUMN IF NOT EXISTS digital_brand text DEFAULT 'prabayar'; -- 'prabayar' | 'pasca'

-- 2. Transaksi: status hasil penjualan (default aman utk trx lama yg sudah Sukses).
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS status text DEFAULT 'Sukses'; -- Sukses | Pending | Gagal | Refund

-- 3. Detail khusus transaksi digital: simpan data Digiflazz per item terjual.
CREATE TABLE IF NOT EXISTS transaksi_digital (
  id         serial PRIMARY KEY,
  transaksi_id  int  NOT NULL REFERENCES transaksi(id),
  produk_id     int,
  buyer_sku_code text NOT NULL,
  customer_no   text NOT NULL,
  ref_id        text NOT NULL UNIQUE,      -- ref unik Digiflazz (juga buat lookup cek-status)
  commands      text DEFAULT 'topup',      -- topup | inq-pasca | pay-pasca
  modal         int,                        -- harga modal Digiflazz
  harga_jual    int NOT NULL,
  status        text DEFAULT 'Pending',    -- Pending | Sukses | Gagal | Refund
  sn            text,                      -- SN / voucher / reg (Sukses)
  message       text,                      -- pesan Digiflazz
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transaksi_digital_status ON transaksi_digital(status);
CREATE INDEX IF NOT EXISTS idx_transaksi_digital_transaksi ON transaksi_digital(transaksi_id);
