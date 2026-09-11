// Validasi input item virtual katalog ("Lainnya"): dipakai route /api/item-virtual
// (POST & PATCH) supaya aturannya satu tempat dan bisa diuji tanpa DB.
//
// Harga WAJIB angka >= 0: baris virtual berharga 0 bikin Σ grup ≠ total bon —
// persis bug yang fitur ini perbaiki. Entri cacat DITOLAK, bukan dijadikan 0.

export type ItemVirtualInput = { nama: string; harga: number }

export function validasiItemVirtual(body: unknown): { ok: true; nilai: ItemVirtualInput } | { ok: false; error: string } {
  const b = (body ?? {}) as { nama?: unknown; harga?: unknown }
  const nama = typeof b.nama === 'string' ? b.nama.trim().slice(0, 120) : ''
  if (!nama) return { ok: false, error: 'Nama wajib diisi' }

  // Number() saja tidak cukup: Number(null) = 0 dan Number(true) = 1 lolos
  // diam-diam. Terima angka asli & string angka saja.
  const baku = typeof b.harga === 'number' || (typeof b.harga === 'string' && b.harga.trim() !== '')
  const harga = baku ? Number(b.harga) : NaN
  if (!Number.isFinite(harga) || harga < 0) return { ok: false, error: 'Harga tidak valid' }

  return { ok: true, nilai: { nama, harga: Math.round(harga) } }
}
