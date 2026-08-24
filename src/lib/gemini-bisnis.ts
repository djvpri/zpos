// SERVER-ONLY — jangan diimpor di komponen 'use client'. Memakai GEMINI_API_KEY
// yang TIDAK boleh terlihat di browser. Komponen client haru panggil endpoint
// `/api/ai/bisnis` milik ZPOS sendiri (cookie session), yang lalu memanggil
// fungsi ini di server. Lihat api/ai/bisnis/route.ts.
//
// Analisis ringkasan transaksi toko → arahan/saran bisnis (teks pendek, murah).
// Text-only request ke model flash-lite biayanya desimal rupiah per panggilan.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-3.5-flash-lite'

export interface RingkasanBisnis {
  // Angka mentah dari DB (ringkas, hemat token) — dihitung di route.
  jumlahTransaksi: number
  totalPenjualan: number
  produkTerlaris: { nama: string; qty: number; total: number }[]
  stokMenipis: { nama: string; stok: number; qty: number }[]
  takLaku: { nama: string; stok: number }[]
  jamSibuk: { jam: number; jual: number }[]
}

export interface HasilBisnis {
  arahan: string   // prosa saran bisnis (markdown ringan, bahasa Indonesia)
  error?: string
}

/**
 * Kirim ringkasan bisnis (agregat DB 30 hari) ke Gemini → arahan/saran.
 * Restrict output ke teks bebas (bukan JSON) supaya enak dibaca pengguna.
 */
export async function analisaBisnis(
  r: RingkasanBisnis,
  apiKey?: string
): Promise<HasilBisnis> {
  const key = apiKey ?? process.env.GEMINI_API_KEY
  if (!key) {
    return { arahan: '', error: 'GEMINI_API_KEY belum di-set. Set di env Railway.' }
  }

  const fmtRp = (n: number) => 'Rp' + n.toLocaleString('id-ID')
  const terlaris = r.produkTerlaris.map(p => `- ${p.nama}: ${p.qty} pcs (${fmtRp(p.total)})`).join('\n') || '- tidak ada'
  const menipis = r.stokMenipis.map(p => `- ${p.nama}: sisa ${p.stok} (jual ${p.qty} pcs)`).join('\n') || '- tidak ada'
  const laku = r.takLaku.map(p => `- ${p.nama}: stok ${p.stok}`).join('\n') || '- tidak ada'
  const jam = r.jamSibuk.map(j => `- ${j.jam}:00-${j.jam + 1}:00 → ${j.jual} transaksi`).join('\n') || '- tidak ada'

  const prompt = `Kamu asisten bisnis minimarket/member kecil di Indonesia. Berdasarkan data transaksi toko ini selama 30 hari terakhir, beri ARAHAN & SARAN yang konkret & bisa langsung dipakai pemilik toko.

RINGKASAN DATA (30 HARI):
- Total transaksi: ${r.jumlahTransaksi}
- Total penjualan: ${fmtRp(r.totalPenjualan)}
- Produk terlaris:
${terlaris}
- Produk yang stoknya menipis padahal laku (risiko kehabisan):
${menipis}
- Produk yang TIDAK terjual sama sekali 30 hari ini (kandidat diskon/berhenti):
${laku}
- Jam tersibuk dalam sehari:
${jam}

Tugas: beri saran dalam 4 bagian pendek (maksimal total ~350 kata), bahasa Indonesia santai tapi profesional, pakai poin singkat:
1. **Pendapatan & Produk** — produk/menu yang perlu diperkuat, peluang naikkan stok terlaris.
2. **Stok & Rugi** — produk mana yang perlu segera di-stok ulang vs yang sebaiknya didiskon/berhenti (jangan biarkan stok mati).
3. **Pelanggan & Operasional** — saran jadwal staff di jam sibuk, promosi di jam sepi, peluang penjualan.
4. **Langkah Besar Berikutnya** — 3 aksi paling berdampak minggu ini (paling penting di atas).

Jangan mengarang angka di luar data yang diberikan. Jika data kosong/tak cukup, katakan jujur dan beri saran umum. Jangan tambahkan apa pun di luar 4 bagian.`

  try {
    const res = await fetch(`${GEMINI_URL}/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { arahan: '', error: `Gemini error ${res.status}: ${txt.slice(0, 150)}` }
    }

    const d = await res.json()
    const teks = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
    if (!teks) {
      return { arahan: '', error: 'Gemini tidak mengembalikan konten.' }
    }
    return { arahan: teks.trim() }
  } catch {
    return { arahan: '', error: 'Gagal memanggil Gemini (jaringan/timeout).' }
  }
}
