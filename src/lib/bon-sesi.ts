// Utilitas sesi bon gantung.
//
// Skema storage: `sesi_json` = array snapshot final tiap sesi, item terlama dulu:
//   [{ t: ISO, p: Record<string, number>, h?: Record<string, number> }, ...]
//   (p = full qty produk pada sesi tsb; h = harga satuan SAAT sesi dibuat, opsional —
//    absen pada bon lama → pemanggil fallback ke harga_json bon / katalog).
// `produk_json` tetap flat FINAL sbg sekarang (= snapshot terakhir) utk kompat EXE lama.
// Bon lama / tanpa sesi_json → 1 sesi sintesis { t: created_at, p: {produk_json} }.

export interface BonSesi {
  t: string       // waktu sesi
  p: Record<string, number>
  h?: Record<string, number>  // harga per produk saat sesi dibuat (opsional)
}

// Normalisasi peta harga: hanya angka valid >= 0 (buang null/NaN/''/negatif).
function parseHargaMap(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Record<string, number> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(x)
    if (Number.isFinite(n) && n >= 0) out[k] = n
  }
  return Object.keys(out).length ? out : undefined
}

// Baca produk flat dari produk_json dgn aman (objek / legacy bentuk lain).
export function parseProdukFlat(produk_json: string, fallback: Record<string, number> = {}): Record<string, number> {
  if (!produk_json) return fallback
  try {
    const v = JSON.parse(produk_json)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, number>
  } catch { /* abaikan */ }
  return fallback
}

// Baca daftar sesi dari sesi_json dgn aman. Return [] bila null/format tidak dikenal.
export function parseSesiJson(sesi_json: string | null): BonSesi[] {
  if (!sesi_json) return []
  try {
    const v = JSON.parse(sesi_json)
    if (Array.isArray(v)) {
      return v
        .filter(x => x && typeof x.t === 'string' && x.p && typeof x.p === 'object' && !Array.isArray(x.p))
        .map(x => {
          const s: BonSesi = { t: x.t, p: x.p as Record<string, number> }
          const h = parseHargaMap((x as { h?: unknown }).h)
          if (h) s.h = h
          return s
        })
    }
  } catch { /* abaikan */ }
  return []
}

// Resolusi sesi penuh utk sebuah bon: jamin minimal 1 sesi (awalnya disintesis dari created_at).
export function resolveSesi(
  sesi_json: string | null,
  produk_json: string,
  created_at: Date | string,
): BonSesi[] {
  const fromSesi = parseSesiJson(sesi_json)
  if (fromSesi.length) return fromSesi
  const flat = parseProdukFlat(produk_json)
  if (!Object.keys(flat).length) return []
  const t = created_at instanceof Date ? created_at.toISOString() : new Date(created_at).toISOString()
  return [{ t, p: flat }]
}

// Tambah sesi baru ke array lantaran. Menyimpan snapshot penuh terakhir.
export function appendSesi(
  sebelum: BonSesi[],
  t: ISO,
  final: Record<string, number>,
  harga?: Record<string, number>,
): BonSesi[] {
  if (!Object.keys(final).length) return sebelum
  const s: BonSesi = { t, p: final }
  const h = parseHargaMap(harga)
  if (h) s.h = h
  return [...(sebelum && sebelum.length ? sebelum : []), s]
}

// Selisih POSITIF antar dua snapshot → item/qty yang hadir/naik pada sesi `baru`.
// Dipakai server utk render grup "tambahan". Null untuk sesi pertama (awal) → full item awal.
export function deltaPositif(sebelum: Record<string, number> | null, kini: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, q] of Object.entries(kini)) {
    const prev = sebelum ? (sebelum[id] || 0) : 0
    const d = q - prev
    if (d > 0) out[id] = d
  }
  return out
}

type ISO = string

// Normalisasi `sesi` dari klien (kasir) → array sesi valid. Buang id/qty non-positif
// & selaras `h` (harga per-sesi hanya utk produk yg ada di sesi itu).
export function normalSesi(raw: unknown): BonSesi[] {
  if (!Array.isArray(raw)) return []
  const out: BonSesi[] = []
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue
    const t = typeof (g as BonSesi).t === 'string' ? (g as BonSesi).t : null
    const pRaw = (g as BonSesi).p
    if (!t || !pRaw || typeof pRaw !== 'object' || Array.isArray(pRaw)) continue
    const p: Record<string, number> = {}
    for (const [id, q] of Object.entries(pRaw)) {
      const n = Number(id), qq = Number(q)
      if (Number.isInteger(n) && n > 0 && Number.isInteger(qq) && qq > 0) p[String(n)] = qq
    }
    if (!Object.keys(p).length) continue
    const s: BonSesi = { t, p }
    const h = parseHargaMap((g as BonSesi).h)
    if (h) {
      const hh: Record<string, number> = {}
      for (const [id, v] of Object.entries(h)) if (p[id] != null) hh[id] = Math.round(v)
      if (Object.keys(hh).length) s.h = hh
    }
    out.push(s)
  }
  return out
}
