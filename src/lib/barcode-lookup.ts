// Barcode Lookup dari Open Food Facts (gratis, tanpa API key).
// Murni, tanpa auth/DB — bisa diuji langsung Node.
//
// Coverage TERBATAS: mayoritas produk riil minimarket Indonesia (kode 899/896,
// barang lokal/UKM) TIDAK terdaftar di OFP; yang ada umumnya merek global.
// Tidak ketemu → return null (bukan throw) supaya klien lanjut tanpa hasil.

const OFP_URL = 'https://world.openfoodfacts.org/api/v2/product'
const FIELDS = 'product_name,brands,categories'
const TIMEOUT_MS = 6000

export interface BarcodeInfo {
  nama: string | null
  merek: string | null
  kategori: string | null
}

export function isBarcodeValid(bc: string): boolean {
  return /^\d{8,13}$/.test(bc)
}

export async function lookupBarcode(barcode: string): Promise<BarcodeInfo | null> {
  try {
    const res = await fetch(`${OFP_URL}/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'ZPos-POS/1.0 (https://github.com/djvpri/zpos)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const data = await res.json()
    if (!data || data.status !== 1 || !data.product) return null

    const nama = (data.product.product_name as string)?.trim()
    return {
      nama: nama || null,
      merek: (data.product.brands as string)?.trim() || null,
      // Kategori OFP bahasa Inggris & sering berantakan — dipakai sekadar hint opsional.
      kategori: String(data.product.categories || '').split(',').map((s: string) => s.trim()).filter(Boolean)[0] || null,
    }
  } catch {
    // timeout/network — balas null, jangan blokir alur kasir.
    return null
  }
}
