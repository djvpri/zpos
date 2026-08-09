// One-shot: buat tabel `produk_duplikat` (fitur deteksi duplikat foto) + verifikasi.
// Jalankan: DATABASE_URL="postgres://..." node --experimental-strip-types scripts/migrate-produk-duplikat.mts
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })

try {
  await sql`
    CREATE TABLE IF NOT EXISTS produk_duplikat (
      id           SERIAL PRIMARY KEY,
      toko_id      INT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
      produk_id_a  INT NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
      produk_id_b  INT NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
      skor         FLOAT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sama','bukan')),
      dibuat_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (produk_id_a < produk_id_b),
      UNIQUE (toko_id, produk_id_a, produk_id_b)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_duplikat_toko ON produk_duplikat(toko_id, status)`
  await sql`CREATE INDEX IF NOT EXISTS idx_duplikat_a ON produk_duplikat(produk_id_a)`
  await sql`CREATE INDEX IF NOT EXISTS idx_duplikat_b ON produk_duplikat(produk_id_b)`

  const [c] = await sql`SELECT COUNT(*)::int AS n FROM produk_duplikat`
  const [cols] = await sql`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='produk_duplikat'`
  console.log('OK produk_duplikat rows=' + c.n + ' cols=' + cols.n)
} catch (e) {
  console.error('GAGAL:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
