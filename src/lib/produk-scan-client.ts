// Client-safe: panggil endpoint ZPOS sendiri (/api/produk/scan-visual, pakai
// cookie session), BUKAN ZFace langsung — CROSS_APP_SECRET tidak pernah
// terkirim/terlihat di browser, dan tokoId ditentukan server dari sesi.

export interface HasilCari {
  produk_id: string
  nama: string
  harga: number
  foto_url: string | null
  foto_thumb?: string | null
  confidence: number
  status: 'tinggi' | 'sedang' | 'rendah'
}

export async function scanProdukVisual(fotoBlob: Blob, topK = 3): Promise<HasilCari[]> {
  const fd = new FormData()
  fd.append('file', fotoBlob, 'scan.jpg')
  fd.append('top_k', String(topK))

  const res = await fetch('/api/produk/scan-visual', { method: 'POST', body: fd })
  if (!res.ok) return []
  const d = await res.json()
  return d.hasil || []
}
