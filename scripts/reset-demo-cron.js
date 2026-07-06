// Dipanggil Railway Cron Job (service TERPISAH di project yang sama,
// dengan Cron Schedule diisi, misal '0 0 * * *' = tengah malam tiap hari).
// Env yang wajib di-set DI SERVICE CRON INI (bukan di service utama):
//   ZPOS_URL          = https://zpos.zomet.my.id
//   DEMO_RESET_SECRET = sama persis dengan yang di-set di service utama ZPOS

const url = (process.env.ZPOS_URL || 'https://zpos.zomet.my.id') + '/api/demo/reset-daily'
const secret = process.env.DEMO_RESET_SECRET

if (!secret) {
  console.error('DEMO_RESET_SECRET belum di-set di service cron ini.')
  process.exit(1)
}

fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
  .then(async (res) => {
    const data = await res.json().catch(() => ({}))
    console.log(`[${new Date().toISOString()}] Status ${res.status}:`, JSON.stringify(data))
    process.exit(res.ok ? 0 : 1)
  })
  .catch((e) => {
    console.error('Gagal panggil endpoint reset-daily:', e.message)
    process.exit(1)
  })
