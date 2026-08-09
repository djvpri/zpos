-- Migration: nomor shift per toko per hari (reset tiap hari).
-- `nomor_shift` = urutan buka shift di toko itu pada tanggal (buka_at) yg sama:
-- shift pertama toko ini hari ini = 1, berikutnya 2, dst; besok mulai 1 lagi.
-- `id` (global auto-increment) tetap internal utk relasi/FK.
ALTER TABLE shift ADD COLUMN IF NOT EXISTS nomor_shift INT;

-- Backfill: nomor utk shift yg sudah ada, urutkan by buka_at (nilai NULL → id utk aman).
WITH berurut AS (
  SELECT id, toko_id,
         row_number() OVER (PARTITION BY toko_id, buka_at::date ORDER BY buka_at, id) AS rn
  FROM shift
)
UPDATE shift s SET nomor_shift = b.rn
FROM berurut b
WHERE s.id = b.id AND s.nomor_shift IS NULL;

-- Indeks penunjang utk hitung & backfill.
CREATE INDEX IF NOT EXISTS idx_shift_nomor ON shift(toko_id, buka_at, nomor_shift);
