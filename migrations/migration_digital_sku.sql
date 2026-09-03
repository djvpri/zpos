-- Z1Pos: pustaka/master SKU Digiflazz utk fitur "Pulsa otomatis masuk semua toko".
-- Idempotent (aman dijalanin berulang).

-- Master SKU Digiflazz (berlaku global). Sumber: kolom dr pricelist Digiflazz.
CREATE TABLE IF NOT EXISTS digital_sku (
  buyer_sku_code   text PRIMARY KEY,           -- kode Digiflazz (xld10, pln, ...)
  product_name     text NOT NULL,              -- nama produk (utk nama produk di toko)
  category         text,                       -- kategori pricelist (Pulsa, Data, PLN, ...)
  brand            text,                       -- merek/operator (XL, Telkomsel, PLN ...)
  harga_modal      int  DEFAULT 0,             -- harga dasar Digiflazz terakhir (refresh)
  digital_brand    text DEFAULT 'prabayar',    -- 'prabayar' | 'pasca'
  -- margin MASTER (1x, milik owner) — berlaku semua toko. Sinkron ke row produk
  -- tiap SKU saat materialisasi; server transaksi baca dari sini (authoritative).
  margin_type      text,                       -- 'persen' | 'nominal' | NULL=belum diatur
  margin_persen    int,
  margin_nominal   int,
  aktif            boolean NOT NULL DEFAULT true,  -- owner bisa matikan SKU (hilang dari kasir semua toko)
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_digital_sku_aktif ON digital_sku(aktif);
