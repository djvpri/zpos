// SERVER-ONLY — thumbnail kecil (base64 WEBP ~48px) dari foto produk, dipakai
// utk grid kasir supaya payload API ringan (foto besar hingga ~100KB TIDAK
// dikirim semua di list; thumbnail ~1-3KB saja). Pakai sharp (bundled Next).
// Gagal → null (kasir fallback ke nama/emoji), jangan pernah mengagalkan flow.
import * as sharpMod from 'sharp'
// sharp export default (CJS). Di ESM `import * as` mengikatnya ke .default;
// di bundler (Next) bisa langsung. Normalisasi di sini.
const sharp = (sharpMod as any).default ?? sharpMod

export async function buatThumbnail(fotoUrl: string, size = 48): Promise<string | null> {
  try {
    const base64 = String(fotoUrl).replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
    const buf = Buffer.from(base64, 'base64')
    const webp = await sharp(buf).rotate().resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    return `data:image/webp;base64,${webp.toString('base64')}`
  } catch {
    return null
  }
}
