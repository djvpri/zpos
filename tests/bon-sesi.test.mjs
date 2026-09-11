// Test server: lib/bon-sesi (asli, via --experimental-strip-types).
// Fokus: harga PER-SESI (`h`) — bon #103 demo: grup 1 = 21.000, grup 4 = 15.000.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalSesi, resolveSesi, appendSesi, parseSesiJson, deltaPositif, grupDariSesi } from '../src/lib/bon-sesi.ts'

test('normalSesi: simpan h & selaraskan dgn p', () => {
  const s = normalSesi([{ t: 'x', p: { 175: 1 }, h: { 175: 21000, 999: 5 } }])
  assert.equal(s.length, 1)
  assert.equal(s[0].h?.['175'], 21000)
  assert.equal(s[0].h?.['999'], undefined, 'h utk produk yg tak ada di p dibuang')
})

test('normalSesi: sanitasi non-positif & bentuk rusak', () => {
  assert.deepEqual(normalSesi([{ t: 'x', p: { 0: 1, '-2': 3, 175: 0, 184: 2 } }])[0].p, { 184: 2 })
  assert.deepEqual(normalSesi('bukan array'), [])
  assert.deepEqual(normalSesi([{ p: { 175: 1 } }]), [], 'tanpa t → dibuang')
  assert.deepEqual(normalSesi([{ t: 'x', p: { 175: 1 }, h: { 175: -5 } }])[0].h, undefined, 'harga negatif dibuang')
})

test('parseSesiJson: round-trip h', () => {
  const raw = JSON.stringify([
    { t: '2026-09-09T07:41:00.000Z', p: { 175: 1 }, h: { 175: 21000 } },
    { t: '2026-09-10T08:55:00.000Z', p: { 175: 4 }, h: { 175: 15000 } },
  ])
  const s = parseSesiJson(raw)
  assert.equal(s[0].h?.['175'], 21000)
  assert.equal(s[1].h?.['175'], 15000)
})

test('parseSesiJson: bon lama tanpa h → tetap valid (h undefined)', () => {
  const s = parseSesiJson(JSON.stringify([{ t: 'x', p: { 175: 2 } }]))
  assert.equal(s.length, 1)
  assert.equal(s[0].h, undefined)
})

test('appendSesi: teruskan harga sesi baru', () => {
  const out = appendSesi([{ t: 'a', p: { 175: 1 }, h: { 175: 21000 } }], 'b', { 175: 4 }, { 175: 15000 })
  assert.equal(out.length, 2)
  assert.equal(out[1].h?.['175'], 15000)
})

test('resolveSesi: bon lama (tanpa sesi_json) → 1 sesi dari created_at, TANPA h', () => {
  const s = resolveSesi(null, JSON.stringify({ 175: 2 }), new Date('2026-09-09T07:41:00Z'))
  assert.equal(s.length, 1)
  assert.equal(s[0].p['175'], 2)
  assert.equal(s[0].h, undefined, 'bon pra-fitur → fallback harga_json/katalog, bukan h')
})

test('deltaPositif: qty kumulatif → delta per grup', () => {
  assert.deepEqual(deltaPositif({ 175: 1 }, { 175: 4 }), { 175: 3 })
  assert.deepEqual(deltaPositif(null, { 175: 1 }), { 175: 1 })
  assert.deepEqual(deltaPositif({ 175: 4 }, { 175: 4 }), {}, 'tak naik → kosong')
})

// Skenario nyata: harga rata-rata tertimbang dgn delta (dipakai nota items flat).
test('bon #103: grup 1 = 21.000, grup 4 = 15.000, rata2 tertimbang 16.500', () => {
  const sesi = normalSesi([
    { t: '2026-09-09T07:41:00.000Z', p: { 175: 1 }, h: { 175: 21000 } },
    { t: '2026-09-10T08:55:00.000Z', p: { 175: 4 }, h: { 175: 15000 } },
  ])
  // grup 4 qty = delta = 3
  assert.equal(deltaPositif(sesi[0].p, sesi[1].p)['175'], 3)
  // harga per grup
  assert.equal(sesi[0].h?.['175'], 21000)
  assert.equal(sesi[1].h?.['175'], 15000)
  // rata2 tertimbang (1×21000 + 3×15000)/4
  const tot = 1 * 21000 + 3 * 15000
  assert.equal(tot / 4, 16500)
})

// --- grupDariSesi: nota per-kiriman ---

const NAMA = (id) => ({ 175: 'Ayam Geprek', 184: 'Beras 5kg' })[id] ?? `Produk #${id}`
const FALLBACK = (id) => ({ 175: 15000, 184: 65000 })[id] ?? 0

// Bentuk APA ADANYA dari DB produksi: `p` ADITIF (tiap grup = kiriman itu),
// `produk_json` = {175:8,184:5} = Σ grup. Bon ini juga punya `h` tiap grup.
const SESI_103 = [
  { t: '2026-09-09T14:41:41.200Z', p: { 175: 1, 184: 1 }, h: { 175: 21000, 184: 65000 } },
  { t: '2026-09-10T15:36:06.000Z', p: { 175: 2, 184: 1 }, h: { 175: 21000, 184: 65000 } },
  { t: '2026-09-10T15:55:57.000Z', p: { 175: 2, 184: 3 }, h: { 175: 15000, 184: 65000 } },
  { t: '2026-09-10T15:57:57.000Z', p: { 175: 3 }, h: { 175: 15000 } },
]
const FINAL_103 = { 175: 8, 184: 5 }

test('grupDariSesi: bon #103 aditif → 4 grup, qty apa adanya, Σ = produk_json', () => {
  const grup = grupDariSesi(normalSesi(SESI_103), FINAL_103, NAMA, FALLBACK)
  assert.ok(grup, 'semua grup punya h + Σ cocok final → mode grup')

  // qty per grup dipakai APA ADANYA (aditif) — jumlahnya balik ke produk_json
  const perProduk = {}
  for (const g of grup) for (const it of g.items) perProduk[it.produk_id] = (perProduk[it.produk_id] ?? 0) + it.qty
  assert.deepEqual(perProduk, FINAL_103)

  // subtotal = qty × harga grup itu
  assert.deepEqual(grup.map(g => g.subtotal), [86000, 107000, 225000, 45000])
  assert.equal(grup.reduce((a, g) => a + g.subtotal, 0), 463000)
  // harga historis dipakai, bukan katalog
  assert.equal(grup[0].items[0].harga, 21000)
  assert.equal(grup[3].items[0].harga, 15000)
})

test('grupDariSesi: bentuk KUMULATIF (web appendSesi) → qty = delta', () => {
  const sesi = normalSesi([
    { t: 'a', p: { 175: 1 }, h: { 175: 21000 } },
    { t: 'b', p: { 175: 4 }, h: { 175: 15000 } },
  ])
  const grup = grupDariSesi(sesi, { 175: 4 }, NAMA, FALLBACK)
  assert.ok(grup, 'p terakhir == final → mode kumulatif')
  assert.deepEqual(grup.map(g => g.items[0].qty), [1, 3], 'grup 2 = delta 4-1')
})

test('grupDariSesi: Σ meleset & p terakhir meleset → null (mode seragam)', () => {
  const sesi = normalSesi([
    { t: 'a', p: { 175: 1 }, h: { 175: 21000 } },
    { t: 'b', p: { 175: 2 }, h: { 175: 15000 } },
  ])
  // final 5: Σ=3 ≠ 5, p terakhir=2 ≠ 5 → tak bisa dipercaya
  assert.equal(grupDariSesi(sesi, { 175: 5 }, NAMA, FALLBACK), null)
})

test('grupDariSesi: ada sesi tanpa h → null (mode seragam)', () => {
  const sesi = normalSesi([
    { t: 'a', p: { 175: 1 }, h: { 175: 21000 } },
    { t: 'b', p: { 175: 3 } },
  ])
  assert.equal(grupDariSesi(sesi, { 175: 3 }, NAMA, FALLBACK), null)
})

test('grupDariSesi: tanpa h sama sekali → null', () => {
  const sesi = normalSesi([{ t: 'a', p: { 175: 2 } }])
  assert.equal(grupDariSesi(sesi, { 175: 2 }, NAMA, FALLBACK), null)
})

test('grupDariSesi: sesi kosong → null', () => {
  assert.equal(grupDariSesi([], { 175: 2 }, NAMA, FALLBACK), null)
})

test('grupDariSesi: h tak lengkap di satu grup → fallback ke harga_json, bukan 0', () => {
  const sesi = normalSesi([
    { t: 'a', p: { 175: 1 }, h: { 175: 21000 } },
    { t: 'b', p: { 175: 1, 184: 1 }, h: { 175: 15000 } }, // 184 tak ada di h
  ])
  const grup = grupDariSesi(sesi, { 175: 2, 184: 1 }, NAMA, FALLBACK)
  assert.ok(grup)
  const beras = grup[1].items.find(it => it.produk_id === 184)
  assert.equal(beras?.harga, 65000, 'jatuh ke hargaFallback (harga_json), bukan 0')
})
