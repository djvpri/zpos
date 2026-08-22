// One-shot: tambah kolom ukuran_label (settingan cetak label per-toko) ke Railway + verify.
// Jalankan: DATABASE_URL="..." node --experimental-strip-types scripts/migrate-ukuran-label.mts
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })
try {
  await sql`ALTER TABLE toko ADD COLUMN IF NOT EXISTS ukuran_label text NOT NULL DEFAULT '50x30'`
  const col = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='toko' AND column_name='ukuran_label'`
  console.log('ukuran_label:', col.length ? 'OK' : 'MISSING')
  const defaultCol = await sql`SELECT column_default FROM information_schema.columns WHERE table_name='toko' AND column_name='ukuran_label'`
  console.log('default:', defaultCol[0]?.column_default ?? 'MISSING')
} catch (e) {
  console.error('ERROR:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
