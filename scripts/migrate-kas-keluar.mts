// One-shot: buat tabel `kas_keluar` (fitur pengeluaran / kas keluar) + verifikasi.
// Jalankan: DATABASE_URL="postgres://..." node --experimental-strip-types scripts/migrate-kas-keluar.mts
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })

try {
  await sql`
    CREATE TABLE IF NOT EXISTS kas_keluar (
      id        SERIAL PRIMARY KEY,
      toko_id   INT NOT NULL REFERENCES toko(id),
      shift_id  INT REFERENCES shift(id),
      user_id   INT REFERENCES "user"(id),
      kategori  VARCHAR(40) NOT NULL DEFAULT 'lainnya',
      nominal   INT NOT NULL CHECK (nominal > 0),
      catatan   TEXT,
      void      BOOLEAN NOT NULL DEFAULT false,
      dibuat_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_kas_keluar_toko ON kas_keluar(toko_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_kas_keluar_shift ON kas_keluar(shift_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_kas_keluar_tgl ON kas_keluar(toko_id, dibuat_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_kas_keluar_void ON kas_keluar(toko_id, void) WHERE void = false`

  const [c] = await sql`SELECT COUNT(*)::int AS n FROM kas_keluar`
  const [cols] = await sql`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='kas_keluar'`
  console.log('OK kas_keluar rows=' + c.n + ' cols=' + cols.n)
} catch (e) {
  console.error('GAGAL:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
