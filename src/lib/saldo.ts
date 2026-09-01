// Helper harga debet saldo tenant utk produk digital (jual pulsa via Digiflazz).
// Model saldo: tenant top-up deposit ke owner; owner top-up ke Digiflazz.
// Saat tenant jual pulsa, server DEBIT saldo_toko = harga_debet (modal Digiflazz + margin owner).
// margin owner bisa PERSEN(%) atau NOMINAL(Rp) terhadap modal, diset owner per produk.

export interface MarginSpec {
  margin_type: string | null    // 'persen' | 'nominal' (default 'persen' utk kompat)
  margin_persen: number | null  // % tambahan thd modal
  margin_nominal: number | null // Rp tetap tambahan thd modal
}

// harga_debet = modal + margin. Dibulatkan ke bilangan bulat.
// ponytail: hanya per produk saja; bila nanti margin global/paket per owner, tambahkan config di sini.
export function hitungHargaDebet(modal: number, spec: MarginSpec): number {
  const m = Number(modal) || 0
  if (spec.margin_type === 'nominal') {
    const fixed = Number(spec.margin_nominal) || 0
    return m + fixed
  }
  // default 'persen'
  const pct = Number(spec.margin_persen) || 0
  return m + Math.round((m * pct) / 100)
}
