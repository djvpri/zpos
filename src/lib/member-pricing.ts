// Harga member (harga khusus per kategori member). Logika murni, tanpa React — bisa diuji Node.
//
// Prioritas harga satu baris saat member AKTIF (tertinggi ke terendah):
//   1. `hargaTetap`  — harga TETAP khusus produk × kategori (harga_member.harga) kalau ada.
//   2. `hargaNormal × (1 - diskonPersen/100)` — diskon % kategori member kalau diskonPersen
//      ≠ 0; nilai NEGATIF = markup (member bayar lebih mahal, faktor >1).
//   3. `hargaNormal` (ecer) bila member tak punya kategori / tanpa diskon / tanpa harga tetap.

export interface MemberHargaInput {
  hargaNormal: number
  hargaTetap?: number | null
  diskonPersen?: number | null
}

// Harga satuan efektif utk produk terhadap kategori member. Harga selalu >= 0.
export function hargaMemberEfektif(input: MemberHargaInput): number {
  const dasar = input.hargaNormal
  // 1. harga tetap menang penuh
  if (input.hargaTetap != null && input.hargaTetap > 0) return input.hargaTetap
  // 2. diskon % kategori (0/non-null diabaikan); negatif = markup (lebih mahal)
  const pct = input.diskonPersen ?? 0
  if (pct !== 0) {
    const faktor = 1 - Math.min(pct, 100) / 100  // negatif => faktor >1 (markup)
    return Math.round(Math.max(dasar * faktor, 0))  // clamp >=0
  }
  // 3. normal
  return dasar
}

// Versi Map (produk_id → harga efektif), dipakai kasir saat member dipilih.
// input: kunci produk_id, nilai {hargaNormal, hargaTetap?, diskonPersen?}.
export function mapHargaMemberEfektif(
  rows: Record<number, MemberHargaInput>
): Record<number, number> {
  const out: Record<number, number> = {}
  for (const [id, input] of Object.entries(rows)) out[Number(id)] = hargaMemberEfektif(input)
  return out
}
