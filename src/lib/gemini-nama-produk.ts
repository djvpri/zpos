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
  error?: string         // error internal (key belum diset, timeout, dll)
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
            { text: 'Lihat foto produk minimarket Indonesia. Balas JSON: {"nama": "nama produk di kemasan", "kategori": "kategori produk ini dalam 1-3 kata, misal Makanan/Minuman/Snack/Kebutuhan Harian. Kosongkan jika tidak tahu"}. Jangan tambahkan apa pun selain JSON.' },
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
      return { nama: nama || null, kategori: kategori || null }
    } catch {
      return { nama: teks ? teks.trim() : null }
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
