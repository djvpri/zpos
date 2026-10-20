import postgres from 'postgres'

// VPS Postgres internal: no SSL. Set DATABASE_SSL=true utk Railway (SSL wajib).
const sql = postgres(process.env.DATABASE_URL!, { ssl: process.env.DATABASE_SSL === 'true' ? 'require' : false })

// Auto-migrate error_log table. .simple() = no prepared statement cache (08P01).
// Dipanggil sekali per server boot — bukan per-request.
let _migrated = false
export async function pastikanErrorLog() {
  if (_migrated) return
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS error_log (
      id bigserial PRIMARY KEY,
      ts timestamptz NOT NULL DEFAULT now(),
      fingerprint text NOT NULL,
      code text,
      route text,
      method text,
      status int,
      message text,
      param text,
      request_id text,
      device_id text,
      stack text
    )
  `).simple()
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_error_log_ts ON error_log(ts DESC)').simple()
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_error_log_fp ON error_log(fingerprint)').simple()
  _migrated = true
}

export default sql