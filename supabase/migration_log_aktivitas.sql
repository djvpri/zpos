-- Migration: Log aktivitas toko (anti-kecurangan)
-- Jalankan via: psql $DATABASE_URL -f migration_log_aktivitas.sql
--
-- Mencatat aksi sensitif (login, transaksi buat/batal, ubah/hapus produk,
-- hapus member, shift, hapus data) beserta siapa & kapan — bukti & audit
-- utk mencegah/manekan kecurangan kasir & petugas lain.
--
-- Kolom pencari (bukan FK): user_id/nama_user disalin dari sesi JWT lewat
-- helper `catatAktivitas` (tidak join ke tabel user — user bisa dihapus,
-- tapi log harus tetap utuh).

CREATE TABLE IF NOT EXISTS log_aktivitas (
    id          bigserial PRIMARY KEY,
    toko_id     integer NOT NULL,
    user_id     integer,            -- id user pelaku (dari sesi)
    nama_user   text,               -- nama pelaku (userName JWT)
    jabatan     text,               -- 'admin' | 'kasir'
    aksi        text NOT NULL,      -- token aksi, mis: 'transaksi_buat'
    kategori    text NOT NULL DEFAULT 'umum',
    keterangan  text,               -- detail bebas, mis: "ID 12 · no TRX-001 · dibatalkan"
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_aktivitas_toko_waktu
    ON log_aktivitas (toko_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_log_aktivitas_user
    ON log_aktivitas (user_id);
