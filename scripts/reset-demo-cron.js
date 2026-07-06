// Dipanggil SATU Railway Cron Job untuk reset demo di BANYAK app sekaligus
// (bukan satu cron job per app) — cukup tambah satu baris di
// DEMO_RESET_TARGETS tiap kali ada app baru yang punya fitur demo ini,
// tidak perlu bikin service Railway baru lagi.
//
// Env yang dibaca DI SERVICE CRON INI:
//
//   DEMO_RESET_TARGETS = "https://zpos.zomet.my.id|secret1,https://zgold.zomet.my.id|secret2"
//     Format: url|secret dipisah koma. Tiap app punya secret SENDIRI
//     (harus sama dengan DEMO_RESET_SECRET di service utama app itu) —
//     supaya kalau satu secret bocor, tidak otomatis buka akses ke app lain.
//
//   Kalau DEMO_RESET_TARGETS belum diisi (mis. baru setup ZPOS sendirian),
//   fallback ke 2 env var lama (ZPOS_URL + DEMO_RESET_SECRET) supaya
//   setup yang sudah ada tidak perlu diubah.

function ambilTarget() {
  const gabungan = process.env.DEMO_RESET_TARGETS
  if (gabungan) {
    return gabungan.split(',').map((pasangan) => {
      const [url, secret] = pasangan.split('|').map((s) => s.trim())
      return { url: `${url}/api/demo/reset-daily`, secret }
    })
  }
  // Fallback lama — satu target saja.
  const url = (process.env.ZPOS_URL || 'https://zpos.zomet.my.id') + '/api/demo/reset-daily'
  const secret = process.env.DEMO_RESET_SECRET
  return secret ? [{ url, secret }] : []
}

async function resetSatu({ url, secret }) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
    const data = await res.json().catch(() => ({}))
    console.log(`[${new Date().toISOString()}] ${url} -> ${res.status}:`, JSON.stringify(data))
    return res.ok
  } catch (e) {
    console.error(`[${new Date().toISOString()}] ${url} -> GAGAL:`, e.message)
    return false
  }
}

async function main() {
  const target = ambilTarget()
  if (target.length === 0) {
    console.error('Tidak ada target — isi DEMO_RESET_TARGETS atau (ZPOS_URL + DEMO_RESET_SECRET).')
    process.exit(1)
  }

  // Berurutan (bukan paralel) — supaya log lebih mudah dibaca & satu app
  // gagal tidak mengganggu urutan pemanggilan app lain.
  let semuaBerhasil = true
  for (const t of target) {
    const ok = await resetSatu(t)
    if (!ok) semuaBerhasil = false
  }
  process.exit(semuaBerhasil ? 0 : 1)
}

main()
