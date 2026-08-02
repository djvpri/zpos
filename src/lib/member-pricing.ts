// Harga member (harga khusus per kategori member). Logika murni, tanpa React — bisa diuji Node.
//
// Prioritas harga satu baris saat member AKTIF (tertinggi ke terendah):
//   1. `hargaTetap`  — harga TETAP khusus produk × kategori (harga_member.harga) kalau ada.
//   2. `hargaNormal × (1 - diskonPersen/100)` — diskon % kategori member kalau diskon_persen > 0.
//   3. `hargaNormal` (ecer) bila member tak punya kategori / tanpa diskon / tanpa harga tetap.

export interface MemberHargaInput {
  hargaNormal: number
  hargaTetap?: number | null
  diskonPersen?: number | null
}

// Harga satuan efektif utk produk terhadap kategori member. Return 0 dianggap
// "pakai hargaNormal lain yang dihitung dari diskon" — tapi jaga agar selalu > 0.
export function hargaMemberEfektif(input: MemberHargaInput): number {
  const dasar = input.hargaNormal
  // 1. harga tetap menang penuh
  if (input.hargaTetap != null && input.hargaTetap > 0) return input.hargaTetap
  // 2. diskon % kategori
  const pct = input.diskonPersen ?? 0
  if (pct > 0) return Math.round(dasar * (1 - Math.min(100, pct) / 100))
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
