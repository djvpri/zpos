-- Migrasi: fitur MEMBER + KATEGORI MEMBER + HARGA MEMBER (harga khusus per barang).
-- Jalankan MANUAL via psql/node postgres.js (tidak auto-run di build).
--
-- Menambahkan 3 tabel:
--   kategori_member  : kelompok member (mis. "Umum", "Grosir", "VIP") + diskon_persen global.
--   member           : pelanggan (nama, telepon) terikat satu kategori.
--   harga_member     : harga TETAP khusus per produk × kategori (override, menang atas diskon %).
--
-- Prioritas harga di kasir (tertinggi ke terendah):
--   1. harga_member.harga            (harga tetap khusus produk+kategori, kalau ada)
--   2. harga × (1 - diskon_persen/100)  (diskon % kategori, kalau diskon_persen terisi)
--   3. harga normal / dual-pricing grosir

CREATE TABLE IF NOT EXISTS kategori_member (
  id          SERIAL PRIMARY KEY,
  nama        TEXT NOT NULL,
  diskon_persen NUMERIC NOT NULL DEFAULT 0 CHECK (diskon_persen >= 0 AND diskon_persen <= 100),
  toko_id     INTEGER NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (toko_id, nama)
);

CREATE TABLE IF NOT EXISTS member (
  id         SERIAL PRIMARY KEY,
  nama       TEXT NOT NULL,
  telepon    TEXT,
  kategori_member_id INTEGER REFERENCES kategori_member(id) ON DELETE SET NULL,
  toko_id    INTEGER NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_telepon ON member (toko_id, telepon);
CREATE INDEX IF NOT EXISTS idx_member_toko   ON member (toko_id);

CREATE TABLE IF NOT EXISTS harga_member (
  id         SERIAL PRIMARY KEY,
  produk_id  INTEGER NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
  kategori_member_id INTEGER NOT NULL REFERENCES kategori_member(id) ON DELETE CASCADE,
  toko_id    INTEGER NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  harga      INTEGER NOT NULL CHECK (harga > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (produk_id, kategori_member_id)
);
CREATE INDEX IF NOT EXISTS idx_harga_member_produk ON harga_member (produk_id);
CREATE INDEX IF NOT EXISTS idx_harga_member_kat    ON harga_member (kategori_member_id);

-- Konsisten dgn tabel lain (migration_multitenant): auth via JWT (Bun/Directus dll),
-- bukan Supabase RLS. Tabel baru dibikin tanpa RLS policies → matikan RLS biar API
-- pakai filter toko_id di query (pola yang sama dgn produk/transaksi).
ALTER TABLE kategori_member DISABLE ROW LEVEL SECURITY;
ALTER TABLE member       DISABLE ROW LEVEL SECURITY;
ALTER TABLE harga_member DISABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN kategori_member.diskon_persen IS 'Diskon global % utk anggota kategori ini. 0 = tanpa diskon %.';
COMMENT ON COLUMN member.telepon IS 'Nomor telepon member — dipakai utk lookup di kasir.';
COMMENT ON COLUMN harga_member.harga IS 'Harga tetap khusus produk × kategori. Override, menang atas diskon_persen.';
