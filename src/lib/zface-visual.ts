/**
 * Helper untuk ZFace Visual Search (CLIP product recognition)
 */

const ZFACE_URL = process.env.NEXT_PUBLIC_ZFACE_API_URL || 'https://zface.zomet.my.id'
const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026'
const APP_SLUG = 'zpos'

export interface HasilCari {
  produk_id: string
  nama: string
  harga: number
  foto_url: string | null
  confidence: number
  status: 'tinggi' | 'sedang' | 'rendah'
}

/** Kirim foto produk ke ZFace untuk disimpan embeddingnya */
export async function embedProduk(params: {
  produkId: string | number
  nama: string
  harga: number
  fotoBase64: string   // base64 tanpa prefix
  tokoId: string | number
  fotoUrl?: string
}): Promise<boolean> {
  try {
    const blob = base64ToBlob(params.fotoBase64, 'image/jpeg')
    const fd = new FormData()
    fd.append('file', blob, 'produk.jpg')
    fd.append('tenant_id', String(params.tokoId))
    fd.append('app_slug', APP_SLUG)
    fd.append('produk_id', String(params.produkId))
    fd.append('nama', params.nama)
    fd.append('harga', String(params.harga))
    if (params.fotoUrl) fd.append('foto_url', params.fotoUrl)

    const res = await fetch(`${ZFACE_URL}/api/produk/embed`, {
      method: 'POST',
      headers: { 'x-cross-app-secret': CROSS_APP_SECRET },
      body: fd,
    })
    return res.ok
  } catch { return false }
}

/** Kirim foto dari kamera kasir → cari produk yang mirip */
export async function cariProdukDariFoto(params: {
  fotoBlob: Blob
  tokoId: string | number
  topK?: number
}): Promise<HasilCari[]> {
  const fd = new FormData()
  fd.append('file', params.fotoBlob, 'scan.jpg')
  fd.append('tenant_id', String(params.tokoId))
  fd.append('app_slug', APP_SLUG)
  fd.append('top_k', String(params.topK || 3))

  const res = await fetch(`${ZFACE_URL}/api/produk/cari`, {
    method: 'POST',
    headers: { 'x-cross-app-secret': CROSS_APP_SECRET },
    body: fd,
  })
  if (!res.ok) return []
  const d = await res.json()
  return d.hasil || []
}

/** Hapus embedding saat produk dihapus */
export async function hapusEmbedding(params: {
  produkId: string | number
  tokoId: string | number
}): Promise<void> {
  try {
    await fetch(
      `${ZFACE_URL}/api/produk/${params.produkId}?tenant_id=${params.tokoId}&app_slug=${APP_SLUG}`,
      { method: 'DELETE', headers: { 'x-cross-app-secret': CROSS_APP_SECRET } }
    )
  } catch {}
}

function base64ToBlob(base64: string, mime: string): Blob {
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  const bin = atob(clean)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
