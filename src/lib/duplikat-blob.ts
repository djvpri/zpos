// SERVER-ONLY. Helper murni: konversi foto produk (data URI base64 / URL) → Blob.
// Terpisah dari duplikat-foto supaya bisa dites mandiri tanpa import ZFace.
export async function fotoKeBlob(fotoUrl: string | null): Promise<Blob | null> {
  if (!fotoUrl) return null
  try {
    if (fotoUrl.startsWith('data:')) {
      const m = fotoUrl.match(/^data:([^;]+);base64,(.*)$/)
      if (!m) return null
      const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0))
      return new Blob([bytes], { type: m[1] || 'image/jpeg' })
    }
    if (fotoUrl.startsWith('http')) {
      const res = await fetch(fotoUrl)
      if (!res.ok) return null
      return await res.blob()
    }
    return null
  } catch { return null }
}
