// E2E toko online via HTTP terhadap server local (npm run dev / next start).
// Jalankan DEV server dgn env SAMA lalu:
//   node --experimental-strip-types scripts/e2e-toko-online.mts
import postgres from 'postgres'
import { SignJWT } from 'jose'

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const SECRET: string = process.env.JWT_SECRET || 'e2e-secret'

const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })
const enc = new TextEncoder().encode(SECRET)

interface SignPayload {
  userId: number
  tokoId: number
  nama: string
  userName: string
  email: string
  plan: string
  role: string
}

async function sign(payload: SignPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(enc)
}

const assert = (cond: unknown, msg: string) => { if (!cond) { throw new Error('ASSERT: ' + msg) } else { console.log('  ok -', msg) } }

try {
  // cari toko/user aktif (Demo toko 5, JJ Store toko 6)
  const [toko] = await sql`SELECT u.id as uid, u.toko_id as id, t.nama FROM "user" u JOIN toko t ON t.id = u.toko_id WHERE u.aktif = true AND t.aktif = true AND u.role='admin' ORDER BY u.id LIMIT 1`
  console.log('toko aktif:', toko.id, toko.nama, 'user', toko.uid)
  const token = await sign({ userId: toko.uid, tokoId: toko.id, nama: toko.nama, userName: toko.nama, email: 'x@x.x', plan: 'trial', role: 'admin' })

  const cookie = `zpos_token=${encodeURIComponent(token)}`

  // GET awal
  let r = await fetch(`${BASE}/api/toko-online`, { headers: { cookie } })
  assert(r.status === 200, 'GET /api/toko-online 200')
  let d = await r.json()
  console.log('  state:', JSON.stringify(d))

  // PUT aktifkan
  const sub = 'warung-e2e-' + Date.now().toString().slice(-4)
  r = await fetch(`${BASE}/api/toko-online`, { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ subdomain: sub, toko_online_aktif: true, wa_toko_online: '081234567890' }) })
  assert(r.status === 200, 'PUT toko-online 200')
  d = await r.json()
  assert(d.ok === true && d.subdomain === sub, 'subdomain tersimpan: ' + d.subdomain)

  // bentrok subdomain (pakai sub sama lagi by toko sama? harusnya by-id boleh) — cek by toko lain skip. Test invalid subdomain:
  r = await fetch(`${BASE}/api/toko-online`, { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ subdomain: 'a b', toko_online_aktif: true }) })
  assert(r.status === 400, 'subdomain invalid -> 400')

  // katalog publik (tanpa auth)
  r = await fetch(`${BASE}/api/toko/${sub}`)
  assert(r.status === 200, 'GET /api/toko/:sub 200 (publik, tanpa auth)')
  d = await r.json()
  assert(d.toko && d.toko.nama === toko.nama, 'katalog punya nama toko')
  console.log('  produk count:', Array.isArray(d.produk) ? d.produk.length : 'N/A')

  console.log('ALL E2E PASS')
} catch (e) {
  console.error('E2E FAIL:', e && (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
