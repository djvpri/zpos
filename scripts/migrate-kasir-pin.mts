// One-shot: eksekusi migration kasir_pin_hash (login PIN kasir desktop) ke Railway + verify.
// Jalankan: DATABASE_URL="postgres://..." node --experimental-strip-types scripts/migrate-kasir-pin.mts
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })
try {
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS kasir_pin_hash TEXT`
  const cols = await sql`SELECT column_name FROM information_schema.columns
    WHERE table_name='user' AND column_name='kasir_pin_hash'`
  console.log('kolom kasir_pin_hash:', cols.length ? 'ADA' : 'MISSING')
} catch (e) {
  console.error('ERROR:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
