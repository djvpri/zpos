// Artikel harian otomatis ZPos — dijalankan oleh GitHub Actions (cron 07:00 WIB).
// Generate 1 artikel ZPos via Gemini, INSERT ke Postgres (Railway) langsung.
// Idempoten per-hari UTC: skip kalau sudah ada artikel terbit hari ini.
//
// Env:
//   DATABASE_URL    Railway Postgres
//   GEMINI_API_KEY  Google AI key
//   GEMINI_MODEL    default gemini-2.5-flash (opsional)

import postgres from 'postgres'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const KEY = process.env.GEMINI_API_KEY
const DB_URL = process.env.DATABASE_URL

for (const [k, v] of [['GEMINI_API_KEY', KEY], ['DATABASE_URL', DB_URL]]) {
  if (!v) { console.error(`Env kosong: ${k}`); process.exit(1) }
}

const sql = postgres(DB_URL, { ssl: 'require', max: 1 })

const DEFAULT_KEYWORDS = [
  'mesin kasir','kasir digital','pos','minimarket','toko kelontong','toko bangunan',
  'warung','umkm','kafe','katalog produk','manajemen stok','laporan penjualan','pembayaran qris'
]

// Timpa/amplifikasi kata kunci dgn entry ZPos di Zadv 'kelola app' (kalau ada).
// Sumber: GET {ZADV_KEYWORD_URL}/api/apps (public), ambil PromoApp nama ZPos ->
// (filter cocok 'Z1 Pos' / 'ZPos'). Kirim X-Cross-App-Secret (ZADV_KEYWORD_KEY) utk
// bypass auth JWT Zadv. Fallback ke default saat gagal.
async function fetchZposKeywords() {
  const base = process.env.ZADV_KEYWORD_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/apps`, {
      headers: { 'x-cross-app-secret': process.env.ZADV_KEYWORD_KEY || '' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const apps = await res.json()
    const zpos = (Array.isArray(apps) ? apps : []).find(
      (a) => a?.aktif !== false && /z1\s*pos|zpos/i.test(String(a?.nama || ''))
    )
    if (!zpos) return null
    const kw = [zpos.nama, zpos.tagline, ...(zpos.fitur || [])]
      .map((s) => String(s || '').trim()).filter(Boolean)
    return kw.length ? kw : null
  } catch {
    return null // cron jangan gagal krn Zadv down - pakai keyword default
  }
}

function buildPrompt(keywords) {
  const kw = keywords && keywords.length ? keywords : DEFAULT_KEYWORDS
  const daftar = kw.join(', ')
  return `Kamu penulis konten bisnis untuk produk "ZPos", aplikasi kasir digital (POS) untuk UMKM Indonesia (warung, kafe, toko kelontong, toko bangunan, minimarket). Target pembaca: pemilik UMKM, non-teknis.
Tulis 1 artikel tips bisnis/UMKM singkat dalam Bahasa Indonesia, 350-500 kata. Topik HARUS seputar mengelola toko / kasir digital / mesin kasir / UMKM - bervariasi, JANGAN selalu sama tiap hari, dan JANGAN promosikan produk lain di luar ZPos.
"tags" WAJIB berisi minimal 5 tag. Pilih tag yang relevan dari kata kunci ini (dan tambahkan tag lain yang cocok): ${daftar}.
Kembalikan HANYA JSON (tanpa markdown fence), format:
{"judul":"...", "deskripsi":"1 kalimat singkat", "tags":["mesin kasir","kasir digital","pos","minimarket","umkm"], "konten":"markdown artikel"}
Isi "konten" markdown MURNI (JANGAN pernah pakai tag HTML seperti <strong>, <b>, <em>, <p>): gunakan ** utk tebal, * utk miring, ## utk subjudul, - utk daftar.`
}

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`
  const body = { contents: [{ parts: [{ text: prompt }] }] }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  if (!text) throw new Error('Gemini kembalikan kosong')
  return text
}

function parseJson(text) {
  // Gemini kadang balikin control character (newline mentah dsb) di dalam
  // string JSON — tak valid utk JSON.parse. Buang dulu.
  const clean = text.replace(/[\u0000-\u001F\u007F]/g, ' ')
  try { return JSON.parse(clean) }
  catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error(`Bukan JSON: ${text.slice(0, 120)}`)
    return JSON.parse(clean.slice(start, end + 1))
  }
}

async function todayHasArtikel() {
  const [row] = await sql`
    SELECT COUNT(*)::int AS n FROM artikel
    WHERE published_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
  `
  return row.n > 0
}

async function main() {
  // Idempotensi: kalau sudah ada artikel hari ini (UTC), skip.
  if (await todayHasArtikel()) {
    const [r] = await sql`SELECT MAX(published_at) AS last FROM artikel`
    console.log(`Artikel hari ini sudah ada (terakhir ${r.last}), skip.`)
    await sql.end()
    return
  }

  const json = parseJson(await callGemini(buildPrompt(await fetchZposKeywords())))
  const judul = String(json.judul || '').trim()
  const konten = String(json.konten || '').trim()
  if (!judul || !konten) throw new Error('Gemini hasilkan judul/konten kosong')

  const slug = slugify(judul)
  const tags = Array.isArray(json.tags) ? json.tags.map(String) : []
  // Jaga-jaga: Gemini diinstruksikan min 5, tapi pastikan tak ada yang lolos <5.
  if (tags.length < 5) throw new Error(`Tags hanya ${tags.length} (minimal 5): ${tags.join(', ')}`)
  const deskripsi = String(json.deskripsi || '').trim()

  const rows = await sql`
    INSERT INTO artikel (judul, slug, deskripsi, tags, konten)
    VALUES (${judul}, ${slug}, ${deskripsi || null}, ${tags}, ${konten})
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug
  `
  if (rows.length === 0) {
    console.log(`Slug "${slug}" sudah ada, skip.`)
  } else {
    console.log(`Artikel terbit: ${judul} -> /artikel/${slug}`)
  }
  await sql.end()
}

main().catch(async (e) => {
  console.error('GAGAL:', e.message)
  try { await sql.end() } catch {}
  process.exit(1)
})
