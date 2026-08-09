// SERVER-ONLY — jangan diimpor di komponen 'use client'. Memakai GEMINI_API_KEY
// yang TIDAK boleh terlihat di browser. Komponen client harus panggil endpoint
// `/api/produk/nama-dari-foto` milik ZPOS sendiri (cookie session), yang lalu
// memanggil fungsi ini di server. Lihat api/produk/nama-dari-foto/route.ts.
//
// Gunakan model 3.5 Flash-Lite (murah, cukup utk "nama produk di kemasan").
// Biaya ~Rp 3/foto saat foto dikompres <=384px (1 tile = 258 token input).

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-3.5-flash-lite'

export interface HasilNamaFoto {
  nama: string | null    // null = tak bisa dideteksi
  kategori?: string | null // kategori yang disarankan (opsional, dari foto yang sama)
  harga?: number | null  // harga jual (Rp) jika TERLIHAT JELAS di foto (label harga/plastik); null = tak/belum tentu
  adaTeks?: boolean      // apakah foto punya teks/label yang terlihat (dari Gemini)
  error?: string         // error internal (key belum diset, timeout, dll)
}

/** Parsing JSON yang dikembalikan Gemini: normalisasi harga → number|null. */
export function parseHarga(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : null
  if (typeof v !== 'string') return null
  if (v.trim().startsWith('-') || /^[-–—]$/.test(v.trim())) return null // negatif/"-" → tak valid
  const s = v.replace(/[^\d]/g, '') // buang 'Rp', '.', spasi, dll → hanya angka
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Kirim foto produk (base64 dengan prefix data URI) ke Gemini → beri nama produk.
 * Restrict output ke JSON `{ "nama": "..." }` supaya parsing deterministik.
 */
export async function deteksiNamaDariFoto(
  fotoBase64: string,
  apiKey?: string
): Promise<HasilNamaFoto> {
  const key = apiKey ?? process.env.GEMINI_API_KEY
  if (!key) {
    return { nama: null, error: 'GEMINI_API_KEY belum di-set. Set di env Railway.' }
  }

  try {
    const res = await fetch(`${GEMINI_URL}/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Lihat foto produk minimarket Indonesia. Sebutkan nama produk ini dengan benar dan singkat. Kalau ada teks/label di kemasan, gunakan itu sebagai nama. Kalau TIDAK ada teks sama sekali (misal telur, sayur, buah, produk curah), gambarkan dari penampakan sesingkat mungkin (misal "Telur ayam", "Roti tawar", "Cabai merah"). Baca HARGA JUAL (dalam Rupiah) HANYA jika terlihat jelas di foto — di label harga, tempelan harga, atau cetakan di kemasan (misal "Rp3.500", "harga 7500"). JANGAN menebak atau menyiratkan harga kalau tidak benar-benar terlihat; kalau tak jelas tulis null. Balas JSON: {"nama": "nama produk", "kategori": "kategori produk ini dalam 1-3 kata, misal Makanan/Minuman/Snack/Kebutuhan Harian/Sayur dan Buah. Kosongkan jika tidak tahu", "harga": <angka harga jual dalam Rupiah, HANYA jika terbaca jelas, selain itu null>, "ada_teks": true atau false jika label/teks terlihat di foto}. Jangan tambahkan apa pun selain JSON.' },
            { inline_data: { mime_type: 'image/jpeg', data: fotoBase64.replace(/^data:.*?;base64,/, '') } },
          ],
        }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { nama: null, error: `Gemini error ${res.status}: ${txt.slice(0, 150)}` }
    }

    const d = await res.json()
    const teks = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
    try {
      const parsed = JSON.parse(teks)
      const nama = typeof parsed?.nama === 'string' ? parsed.nama.trim() : ''
      const kategori = typeof parsed?.kategori === 'string' ? parsed.kategori.trim() || null : null
      const harga = parseHarga(parsed?.harga)
      const adaTeks = typeof parsed?.ada_teks === 'boolean' ? parsed.ada_teks : undefined
      return { nama: nama || null, kategori: kategori || null, harga, adaTeks }
    } catch {
      return { nama: teks ? teks.trim() : null, harga: null }
    }
  } catch {
    return { nama: null, error: 'Gagal memanggil Gemini (jaringan/timeout).' }
  }
}

export interface HasilKategori {
  kategori: string | null // rekomendasi kategori (1-3 kata), null = tak tahu
  error?: string
}

/**
 * Sarankan kategori minimarket untuk sebuah nama produk (input manual, tanpa
 * foto). Kirim teks nama → Gemini → JSON `{"kategori":"..."}`. Sama murahnya
 * dgn deteksi nama (text-only request jauh di bawah 1 tile).
 */
export async function saranKategoriDariNama(
  namaProduk: string,
  apiKey?: string
): Promise<HasilKategori> {
  const key = apiKey ?? process.env.GEMINI_API_KEY
  if (!key) {
    return { kategori: null, error: 'GEMINI_API_KEY belum di-set. Set di env Railway.' }
  }

  try {
    const res = await fetch(`${GEMINI_URL}/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Produk minimarket Indonesia bernama "${namaProduk}". Kategorikan ke dalam satu kategori singkat (1-3 kata, huruf kapital awal, bahasa Indonesia), contoh: Makanan, Minuman, Snack, Kebutuhan Harian. Balas JSON: {"kategori": "..."}. Jangan tambahkan apa pun selain JSON.` }],
        }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { kategori: null, error: `Gemini error ${res.status}: ${txt.slice(0, 150)}` }
    }

    const d = await res.json()
    const teks = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
    try {
      const parsed = JSON.parse(teks)
      const kategori = typeof parsed?.kategori === 'string' ? parsed.kategori.trim() || null : null
      return { kategori }
    } catch {
      return { kategori: teks ? teks.trim().slice(0, 50) : null }
    }
  } catch {
    return { kategori: null, error: 'Gagal memanggil Gemini (jaringan/timeout).' }
  }
}
