import postgres from 'postgres'

// VPS Postgres internal: no SSL. Set DATABASE_SSL=true utk Railway (SSL wajib).
const sql = postgres(process.env.DATABASE_URL!, { ssl: process.env.DATABASE_SSL === 'true' ? 'require' : false })
export default sql
