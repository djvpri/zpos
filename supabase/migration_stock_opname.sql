-- Migration: Stock Opname (SO) — hitung stok fisik via scan barcode, per kategori.
--
-- Alur: buka sesi SO -> kasir scan barcode produk (stok_fisik bertambah per scan
-- atau input qty) -> "selesai" hitung selisih (fisik - sistem) utk semua produk
-- dalam cakupan, TANPA ubah stok -> admin "approve" utk menulis produk.stok.
-- Online-only: scan butuh stok_sistem live dari DB (keputusan user).
--
-- Jalankan: node scripts/run_migration.cjs supabase/migration_stock_opname.sql  (atau psql)

CREATE TABLE IF NOT EXISTS stock_opname (
    id           bigserial PRIMARY KEY,
    nomor_so     text NOT NULL,                     -- contoh: SO-20260803-0001
    toko_id      bigint NOT NULL REFERENCES toko(id),
    nama         text NOT NULL DEFAULT '',          -- label opsional dari kasir
    scope        text NOT NULL DEFAULT 'semua',     -- 'semua' | 'kategori:<id>'
    status       text NOT NULL DEFAULT 'proses',    -- proses | selesai | dibatalkan | disetujui
    jumlah_baris int  NOT NULL DEFAULT 0,           -- jumlah detail yang tercatat (snapshot)
    dibuat_oleh  text,
    dibuat_at    timestamptz NOT NULL DEFAULT now(),
    selesai_at   timestamptz,                       -- pas status -> 'selesai'
    disetujui_at timestamptz                        -- pas status -> 'disetujui'
);

CREATE INDEX IF NOT EXISTS idx_so_toko_waktu ON stock_opname (toko_id, dibuat_at DESC);

-- Detail hasil scan. stok_sistem di-snapshot saat detail pertama dibuat supaya
-- selisih stabil walau stok sistem berubah di tengah sesi.
CREATE TABLE IF NOT EXISTS stock_opname_detail (
    so_id        bigint NOT NULL REFERENCES stock_opname(id) ON DELETE CASCADE,
    produk_id    bigint NOT NULL REFERENCES produk(id),
    nama         text,                              -- snapshot nama produk
    barcode      text,
    kategori_id  bigint,                            -- snapshot utk laporan per kategori
    stok_sistem  int NOT NULL DEFAULT 0,
    stok_fisik   int NOT NULL DEFAULT 0,
    selisih      int NOT NULL DEFAULT 0,            -- fisik - sistem (isi pas selesai)
    dicatat_ts   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (so_id, produk_id)
);

CREATE INDEX IF NOT EXISTS idx_so_detail_so ON stock_opname_detail (so_id);
