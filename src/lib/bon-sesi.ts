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

// Rebuild sesi saat klien mengirim snapshot FINAL tanpa `sesi` (web / klien lama):
// jangan append snapshot kumulatif — itu bikin tiap grup memuat SELURUH bon &
// tanpa harga (bug: nota kehilangan pemisahan grup, qty dobel).
//
// Yang benar, dibandingkan thd sesi lama:
//  - qty NAIK  → grup baru berisi DELTA saja, ber-harga dari `hargaBaru`/harga lama.
//  - qty TURUN → buang kelebihannya dari grup terlama yg memuatnya (LIFO), supaya
//    Σ qty tiap id tetap == final; grup yang jadi kosong dibuang.
//  - harga berubah tanpa qty berubah → perbarui `h` grup terakhir yg memuat id itu.
// Bila tak ada perubahan sama sekali → sesi lama dipertahankan.
//
// `hargaBaru` = {id: harga} kiriman klien (harga saat edit); dipakai utk grup baru.
export function sesiDariEdit(
  sebelum: BonSesi[],
  t: ISO,
  final: Record<string, number>,
  hargaBaru?: Record<string, number> | null,
): BonSesi[] {
  const hitung = (sesi: BonSesi[]) => {
    const m: Record<string, number> = {}
    for (const s of sesi) for (const [id, q] of Object.entries(s.p)) m[id] = (m[id] ?? 0) + Number(q)
    return m
  }
  // Klon dangkal supaya tak memutasi input.
  const out: BonSesi[] = sebelum.map(s => ({ t: s.t, p: { ...s.p }, ...(s.h ? { h: { ...s.h } } : {}) }))

  // 1) Turunkan qty berlebih (LIFO dari grup terbaru) — jaga Σ == final.
  //    Iterasi UNION id (final + yg ada di sesi): id yg HILANG dari final (item
  //    dibuang) pun harus ikut dikurangi sampai 0, kalau tidak sisa qty-nya
  //    tertinggal di grup lama dan total bon jadi lebih besar dari kenyataan.
  const kini = hitung(out)
  const semuaId = new Set([...Object.keys(final), ...Object.keys(kini)])
  for (const id of semuaId) {
    const want = Number(final[id] ?? 0)
    let lebih = (kini[id] ?? 0) - want
    for (let i = out.length - 1; i >= 0 && lebih > 0; i--) {
      const punya = Number(out[i].p[id] ?? 0)
      if (punya <= 0) continue
      const buang = Math.min(punya, lebih)
      out[i].p[id] = punya - buang
      if (out[i].p[id] <= 0) delete out[i].p[id]
      lebih -= buang
    }
  }
  // 2) Naikkan qty kurang (ADITIF: tambahkan ke grup yg sudah ada memuat id itu,
  //    else item baru → masuk GRUP BARU).
  const kurang: Record<string, number> = {}
  const kini2 = hitung(out)
  for (const [id, want] of Object.entries(final)) {
    const d = Number(want) - (kini2[id] ?? 0)
    if (d > 0) kurang[id] = d
  }
  // Harga efektif utk grup baru: dari klien, else `h` grup terakhir yang memuat id itu.
  const hBaru: Record<string, number> = {}
  for (const id of Object.keys(kurang)) {
    const dariKlien = Number(hargaBaru?.[id])
    if (Number.isFinite(dariKlien) && dariKlien >= 0) { hBaru[id] = Math.round(dariKlien); continue }
    for (let i = out.length - 1; i >= 0; i--) {
      const h = out[i].h?.[id]
      if (h != null) { hBaru[id] = Number(h); break }
    }
  }
  if (Object.keys(kurang).length) {
    const s: BonSesi = { t, p: kurang }
    if (Object.keys(hBaru).length) s.h = hBaru
    out.push(s)
  } else if (hargaBaru) {
    // 3) qty tetap — hanya harga yg berubah. Perbarui `h` grup terakhir yg memuat id.
    for (const [id, hv] of Object.entries(hargaBaru)) {
      const h = Number(hv)
      if (!Number.isFinite(h) || h < 0) continue
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].p[id] != null) {
          if (!out[i].h) out[i].h = {}
          out[i].h![id] = Math.round(h)
          break
        }
      }
    }
  }
  return out
    .map(s => {
      // `h` harus selaras `p`: entri harga utk id yg tak lagi ada di sesi ini
      // bikin nota menghitung baris hantu (qty 0 tp muncul) → subtotal salah.
      if (s.h) {
        const h: Record<string, number> = {}
        for (const [id, v] of Object.entries(s.h)) if (s.p[id] != null) h[id] = v
        if (Object.keys(h).length) s.h = h
        else delete s.h
      }
      return s
    })
    .filter(s => Object.keys(s.p).length > 0)
}

// Ubah riwayat sesi → daftar GRUP ber-harga utk nota (tiap kiriman = 1 grup).
//
// DUA BENTUK `p` yang beredar — dibedakan otomatis dari `acuanFinal`:
//  - ADITIF (kasir desktop): tiap grup simpan qty kiriman ITU saja.
//    Invarian: Σ qty semua grup per id == qty final. (bon #103: 1+2+2+3=8)
//  - KUMULATIF (web `appendSesi`): tiap grup simpan snapshot penuh saat itu.
//    Invarian: `p` grup TERAKHIR == qty final. (qty per grup = delta)
// Kalau Σ aditif cocok dgn final → pakai apa adanya; kalau `p` terakhir cocok →
// pakai delta; kalau dua-duanya meleset → null (pemanggil pakai mode seragam),
// supaya nota tak pernah menampilkan qty yg salah.
//
// Hanya dipakai bila SETIAP sesi punya `h`; kalau ada satu saja yg kosong,
// kembalikan null → pemanggil pakai mode seragam (harga_json / katalog).
// Nota campur (separuh baris tanpa harga) lebih menyesatkan daripada seragam.
export interface BonGrupItem { produk_id: number; nama: string; harga: number; qty: number; subtotal: number }
export interface BonGrup { waktu: string | null; items: BonGrupItem[]; subtotal: number }

export function grupDariSesi(
  sesi: BonSesi[],
  acuanFinal: Record<string, number>,
  namaDari: (id: number) => string,
  hargaFallback: (id: number) => number,
): BonGrup[] | null {
  if (!sesi.length || !sesi.every(s => s.h && Object.keys(s.h).length > 0)) return null

  const sama = (a: Record<string, number>, b: Record<string, number>) => {
    const ids = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const id of ids) if ((Number(a[id]) || 0) !== (Number(b[id]) || 0)) return false
    return true
  }

  // Bentuk aditif: Σ qty tiap id == final.
  const jum: Record<string, number> = {}
  for (const s of sesi) for (const [id, q] of Object.entries(s.p)) jum[id] = (jum[id] ?? 0) + Number(q)
  const aditif = sama(jum, acuanFinal)
  // Bentuk kumulatif: snapshot terakhir == final.
  const kumulatif = !aditif && sama(sesi[sesi.length - 1].p, acuanFinal)
  if (!aditif && !kumulatif) return null

  const out: BonGrup[] = []
  let prev: Record<string, number> | null = null
  for (const s of sesi) {
    const qtyMap = aditif ? s.p : deltaPositif(prev, s.p)
    if (!aditif) prev = s.p
    const items: BonGrupItem[] = Object.entries(qtyMap).map(([idStr, qty]) => {
      const id = Number(idStr)
      const h = Number(s.h?.[idStr] ?? hargaFallback(id))
      return { produk_id: id, nama: namaDari(id), harga: h, qty: Number(qty), subtotal: Math.round(h * Number(qty)) }
    })
    // Grup tanpa barang baru (sesi menyimpan ulang qty sama) tetap ditampilkan
    // sbg penanda waktu — subtotal 0.
    out.push({ waktu: s.t, items, subtotal: items.reduce((a, b) => a + b.subtotal, 0) })
  }
  return out
}

// Item virtual dari PRESET katalog (tabel item_virtual, id serial POSITIF).
// Kasir desktop memakai hash nama+harga (vidVirtual) sebagai id negatif; web tak
// bisa meniru hash itu tanpa duplikasi algoritma (rawan beda JS↔TS). Web cukup
// memakai id negatif SENDIRI yang jelas & tak bentrok dengan hash kasir:
//   -(1_000_000_000 + idItemVirtual)  → -1.000.000.005 dst
// Hash kasir selalu < 9e15 tapi tak pernah di rentang kecil 1e9..+∞ negatif ini
// (kasir hanya utk nama+harga bebas) — dan kalaupun bentrok, `vmap` menang karena
// kasir selalu restore vmap bon dulu (Object.assign ke virtualProduk).
export const OFFSET_VIRTUAL_WEB = 1_000_000_000
export function idVirtualPreset(idItemVirtual: number): number {
  return -(OFFSET_VIRTUAL_WEB + idItemVirtual)
}
export function idItemVirtualDariPreset(idVirtual: number): number | null {
  if (!Number.isInteger(idVirtual) || idVirtual >= 0) return null
  const n = -idVirtual - OFFSET_VIRTUAL_WEB
  return n > 0 ? n : null
}

// vmap = {idVirtual: {nama, harga}} dari kasir. Dipakai server utk MENAMAI baris
// item virtual (id negatif, "Lainnya") di nota web — tanpa ini barisnya cuma
// tampil "Produk #-1789...". Hanya id negatif yg diterima (positif pakai katalog).
export interface VMapEntry { nama: string; harga: number }
export function normalVmap(raw: unknown): Record<string, VMapEntry> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, VMapEntry> = {}
  for (const [idStr, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(idStr)
    if (!Number.isInteger(id) || id >= 0) continue
    if (!v || typeof v !== 'object') continue
    const nama = String((v as VMapEntry).nama ?? '').trim().slice(0, 120)
    if (!nama) continue
    const h = Number((v as VMapEntry).harga)
    // Harga WAJIB angka >= 0: fallback 0 bikin Σ grup ≠ total (bug yg fitur ini
    // perbaiki). Entri cacat dibuang — baris virtualnya lebih baik absen drpd Rp 0.
    if (!Number.isFinite(h) || h < 0) continue
    out[String(id)] = { nama, harga: Math.round(h) }
  }
  return out
}

// Normalisasi `sesi` dari klien (kasir) → array sesi valid. Buang id/qty non-positif
// & selaras `h` (harga per-sesi hanya utk produk yg ada di sesi itu).
// Id NEGATIF (item virtual "Lainnya") diterima — idnya stabil dari kasir.
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
      if (Number.isInteger(n) && n !== 0 && Number.isInteger(qq) && qq > 0) p[String(n)] = qq
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
