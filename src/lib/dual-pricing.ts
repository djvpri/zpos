// Dual pricing (grosir & ecer). Logika murni, tanpa React — bisa diuji langsung Node.
//
// Aturan: produk pakai harga_grosir kalau qty keranjang >= min_qty_grosir
// (dan harga_grosir terisi). Kalau tidak ada harga_grosir/min_qty_grosir
// (NULL/undefined) → selalu pakai harga ecer.

export interface DualHarga {
  harga: number              // harga ecer (selalu ada)
  harga_grosir?: number | null
  min_qty_grosir?: number | null
}

// Harga satuan efektif untuk satu baris keranjang dengan qty tertentu.
// Saat grosir aktif, pakai nilai yang PALING MENGUNTUNGKAN PEMBELI = harga terkecil
// (min antara ecer & grosir) — jadi kalau admin salah isi harga_grosir > ecer,
// kasir tidak rugi; otomatis tetap pakai harga ecer.
export function hargaEfektif(p: DualHarga, qty: number): number {
  const min = p.min_qty_grosir ?? 0
  if (qty >= min && p.harga_grosir != null && p.harga_grosir > 0 && min > 0) {
    return Math.min(p.harga, p.harga_grosir)
  }
  return p.harga
}

// Apakah baris ini sedang memakai harga grosir (untuk penanda di UI/struk)?
export function isGrosir(p: DualHarga, qty: number): boolean {
  const min = p.min_qty_grosir ?? 0
  return qty >= min && p.harga_grosir != null && p.harga_grosir > 0 && min > 0 && p.harga_grosir <= p.harga
}
