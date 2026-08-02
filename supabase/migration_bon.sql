-- Migrasi: fitur BON GANTUNG (keranjang sementara yang ditahan, dibayar nanti).
-- Jalankan MANUAL via psql/node postgres.js (tidak auto-run di build).
--
-- Satu tabel `bon`: keranjang produk tersimpan sementara. Saat kasir "gantung"
-- transaksi, `produk_json` mencatat {produk_id: qty}. Ditarik kembali nanti utk
-- dilanjutkan/dibayar. Bon hanya sementara — bukan piutang akuntansi.
--
--   produk_json  TEXT   : JSON object {produk_id: qty} (postgres.JSON juga OK, dipakai TEXT utk
--                         konsisten dgn pola payload ringan & mudah diubah balik di klien).
--   total        INTEGER: jumlah rupiah saat digantung (penanda saja; dihitung ulang saat tarik).
--   selesai      BOOLEAN: true kalau bon sudah dibayar/diambil (disembunyikan dari list aktif).

CREATE TABLE IF NOT EXISTS bon (
  id          SERIAL PRIMARY KEY,
  toko_id     INTEGER NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  nama        TEXT,                          -- label bebas (mis. nama pelanggan)
  produk_json TEXT NOT NULL DEFAULT '{}',    -- {'123': 2, '45': 1}
  total       INTEGER NOT NULL DEFAULT 0,
  selesai     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  dibayar_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bon_toko   ON bon (toko_id);
CREATE INDEX IF NOT EXISTS idx_bon_aktif  ON bon (toko_id, selesai);

-- Konsisten dgn tabel lain: auth via JWT, bukan RLS Supabase.
ALTER TABLE bon DISABLE ROW LEVEL SECURITY;
