// Artikel harian otomatis ZPos — dijalankan oleh Railway Cron (07:00 WIB).
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

const PROMPT = `Kamu penulis konten bisnis untuk produk "ZPos", aplikasi kasir digital (POS) untuk UMKM Indonesia (warung, kafe, toko kelontong, toko bangunan, minimarket). Target pembaca: pemilik UMKM, non-teknis.
Tulis 1 artikel tips bisnis/UMKM singkat dalam Bahasa Indonesia, 350-500 kata. Topik HARUS seputar mengelola toko / kasir digital / mesin kasir / UMKM — bervariasi, JANGAN selalu sama tiap hari, dan JANGAN promosikan produk lain di luar ZPos.
"tags" WAJIB berisi minimal 5 tag. Pilih tag yang relevan dari kata kunci ini (dan tambahkan tag lain yang cocok): mesin kasir, kasir digital, pos, minimarket, toko kelontong, toko bangunan, warung, umkm, kafe, katalog produk, manajemen stok, laporan penjualan, pembayaran qris.
Kembalikan HANYA JSON (tanpa markdown fence), format:
{"judul":"...", "deskripsi":"1 kalimat singkat", "tags":["mesin kasir","kasir digital","pos","minimarket","umkm"], "konten":"markdown artikel"}
Isi "konten" markdown MURNI (JANGAN pernah pakai tag HTML seperti <strong>, <b>, <em>, <p> — bukan diperbolehkan): gunakan ** untuk tebal, * untuk miring, ## untuk subjudul, - untuk daftar.`

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

  const json = parseJson(await callGemini(PROMPT))
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
