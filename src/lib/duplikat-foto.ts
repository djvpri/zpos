// SERVER-ONLY. Logika deteksi & pengelompkan foto produk mirip (duplikat).
// Dipakai route /api/produk/cek-duplikat + /api/produk/duplikat.
// ZFace = infra eksternal yang uda dipakai kasir scan-visual (lihat zface-visual).
import { cariProdukDariFoto } from './zface-visual'
import { fotoKeBlob } from './duplikat-blob'

export interface DuplikatPasangan {
  a: number
  b: number
  skor: number
}

// Threshold confidence: 0.85 = cukup yakin foto sama/nyaris sama.
export const THRESHOLD_DUP = 0.85

/**
 * Cari pasangan duplikat dari satu produk ber-foto ke ZFace, kembalikan
 * satu pasangan per-dua-produk (a < b) dengan skor >= threshold.
 * Skip diri sendiri & produk yg tak ada di daftar yang di-scan.
 */
export async function cariPasanganDuplikat(
  produkId: number,
  foto: string | null,
  tokoId: number,
  idSet: Set<number>,
  topK = 5
): Promise<DuplikatPasangan[]> {
  const blob = await fotoKeBlob(foto)
  if (!blob) return []
  const hasil = await cariProdukDariFoto({ fotoBlob: blob, tokoId, topK })
  const out: DuplikatPasangan[] = []
  for (const h of hasil) {
    const bid = Number(h.produk_id)
    if (!Number.isFinite(bid)) continue
    if (bid === produkId || !idSet.has(bid)) continue // diri sendiri / di luar set scan
    if ((h.confidence ?? 0) < THRESHOLD_DUP) continue
    const a = Math.min(produkId, bid)
    const b = Math.max(produkId, bid)
    out.push({ a, b, skor: h.confidence })
  }
  // dedup (a,b) dalam batch ini
  const unik = new Map<string, DuplikatPasangan>()
  for (const p of out) unik.set(`${p.a}:${p.b}`, p)
  return Array.from(unik.values())
}
