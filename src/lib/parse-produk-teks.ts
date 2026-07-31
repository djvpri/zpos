// Parser teks cepat untuk menambah produk massal (TambahCepat).
// Logika murni, tanpa React — bisa diuji langsung di Node.

export interface Item {
  nama: string
  harga: number
  stok: number
  kategori: string
}

// Parse satu baris teks menjadi produk. Format yang didukung (fleksibel):
//   "Nama | 3500 | 50 | Kategori"      (pemisah | , : atau tab)
//   "Nama 3500 50 Kategori"            (spasi)
//   "Nama @3500 stok50 Kategori"       (bentuk rinci)
//   "Nama"                             (nama saja → harga/stok default)
export function parseLine(line: string): Item | null {
  const s = line.trim()
  if (!s) return null

  // Deteksi pemisah yang bukan spasi (| , : ; tab) → pecah berdasarkan itu
  if (/[|,;:\t]/.test(s)) {
    const parts = s.split(/[|,;:\t]+/).map(x => x.trim()).filter(Boolean)
    if (!parts.length) return null
    const [nama, hargaRaw, stokRaw, kategori] = parts
    if (!nama) return null
    return {
      nama,
      harga: parseInt(String(hargaRaw || '').replace(/\D/g, '')) || 0,
      stok: parseInt(String(stokRaw || '').replace(/\D/g, '')) || 0,
      kategori: kategori || '',
    }
  }

  // Format "Nama @harga stokN Kategori" atau gabungan.
  // Pecah kata, cari token harga (angka besar) & stok (angka kecil).
  const tokens = s.split(/\s+/).filter(Boolean)
  let harga = 0
  let stok = 0
  let namaParts: string[] = []

  for (const t of tokens) {
    const clean = t.replace(/[.,]/g, '')
    if (/^\d+$/.test(clean) && parseInt(clean) > 0) {
      const v = parseInt(clean)
      // Heuristik minimarket: nilai ≥ 500 dianggap harga, sisanya stok.
      if (v >= 500 && harga === 0) { harga = v; continue }
      if (stok === 0) { stok = v; continue }
      if (harga === 0) { harga = v; continue }
    } else {
      namaParts.push(t)
    }
  }

  if (!namaParts.length) return null
  return {
    nama: namaParts.join(' '),
    harga,
    stok,
    kategori: '',
  }
}

export function parseText(teks: string): Item[] {
  return teks.split('\n').map(parseLine).filter(Boolean) as Item[]
}
