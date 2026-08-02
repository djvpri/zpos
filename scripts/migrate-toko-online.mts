// One-shot: eksekusi migration toko online ke Railway + verify.
// Jalankan: DATABASE_URL="..." node --experimental-strip-types scripts/migrate-toko-online.mts
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })
try {
  await sql`ALTER TABLE toko ADD COLUMN IF NOT EXISTS subdomain text UNIQUE`
  await sql`ALTER TABLE toko ADD COLUMN IF NOT EXISTS toko_online_aktif boolean DEFAULT false`
  await sql`ALTER TABLE toko ADD COLUMN IF NOT EXISTS wa_toko_online text`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS toko_subdomain_lower_unique ON toko (LOWER(subdomain)) WHERE subdomain IS NOT NULL`
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='toko' AND column_name IN ('subdomain','toko_online_aktif','wa_toko_online') ORDER BY column_name`
  console.log('columns:', cols.map(c => c.column_name).join(', '))
  const idx = await sql`SELECT indexname FROM pg_indexes WHERE tablename='toko' AND indexname='toko_subdomain_lower_unique'`
  console.log('index:', idx.length ? idx[0].indexname : 'MISSING')
} catch (e) {
  console.error('ERROR:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
