-- Kolom untuk mencegah produk terduplikasi saat sinkron ulang antrian
-- offline (lib/offline-produk-mutasi.ts). Kalau penghapusan entry dari
-- antrian lokal gagal TEPAT SETELAH POST /api/produk sukses (kegagalan
-- tulis IndexedDB yang jarang), entry itu bisa ke-retry di flush
-- berikutnya. Tanpa kunci idempotensi, retry itu akan bikin produk kedua
-- yang identik. Dengan client_ref, retry dikenali & baris yang sudah ada
-- dikembalikan alih-alih insert baru — pola yang sama dengan no_transaksi
-- di tabel transaksi.
--
-- Nullable & unique: produk yang dibuat online biasa (bukan dari antrian
-- offline) tidak mengisi kolom ini sama sekali (NULL) — Postgres
-- mengizinkan banyak NULL pada kolom UNIQUE tanpa konflik.

ALTER TABLE produk ADD COLUMN IF NOT EXISTS client_ref TEXT UNIQUE;
