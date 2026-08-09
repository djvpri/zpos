// One-shot: tambah kolom `nomor_shift` (per toko per hari) + backfill + verifikasi.
// Jalankan: DATABASE_URL="postgres://..." node --experimental-strip-types scripts/migrate-shift-nomor.mts
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })

try {
  await sql`ALTER TABLE shift ADD COLUMN IF NOT EXISTS nomor_shift INT`
  await sql`
    WITH berurut AS (
      SELECT id, toko_id,
             row_number() OVER (PARTITION BY toko_id, buka_at::date ORDER BY buka_at, id) AS rn
      FROM shift
    )
    UPDATE shift s SET nomor_shift = b.rn
    FROM berurut b
    WHERE s.id = b.id AND s.nomor_shift IS NULL
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_shift_nomor ON shift(toko_id, buka_at, nomor_shift)`
  const [c] = await sql`SELECT count(*)::int AS total, count(nomor_shift)::int AS dgn, coalesce(max(nomor_shift),0)::int AS mx FROM shift`
  console.log('OK shift: total=' + c.total + ' dgn_nomor=' + c.dgn + ' max_nomor=' + c.mx)
  const sampel = await sql`SELECT id, toko_id, buka_at::date d, nomor_shift FROM shift ORDER BY buka_at DESC LIMIT 6`
  for (const s of sampel) console.log('SHIFT:', JSON.stringify(s))
  if (c.total === c.dgn) console.log('VERIF: semua shift punya nomor_shift (backfill lengkap)')
  else { console.error('VERIF: GAGAL — ada shift tanpa nomor'); process.exitCode = 1 }
} catch (e) {
  console.error('GAGAL:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
