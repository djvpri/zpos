// Test server: lib/bon-sesi (asli, via --experimental-strip-types).
// Fokus: harga PER-SESI (`h`) — bon #103 demo: grup 1 = 21.000, grup 4 = 15.000.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalSesi, resolveSesi, appendSesi, parseSesiJson, deltaPositif } from '../src/lib/bon-sesi.ts'

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
