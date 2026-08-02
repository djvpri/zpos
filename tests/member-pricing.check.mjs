// Self-check logika harga member: prioritas hargaTetap > diskon% > normal.
// Jalankan: node tests/member-pricing.check.mjs
import assert from 'node:assert'
import { hargaMemberEfektif, mapHargaMemberEfektif } from '../src/lib/member-pricing.ts'

// 1. Tanpa member/harga tetap → harga normal
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 15000, diskonPersen: null, hargaTetap: null }), 15000)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 15000 }), 15000)

// 2. Diskon % kategori → harga × (1 - pct/100), dibulatkan
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 15000, diskonPersen: 10 }), 13500)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 9999, diskonPersen: 33.33 }), 6666) // 9999*0.6667≈6666

// 3. Diskon 100% dipotong (tidak boleh negatif/aneh)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 10000, diskonPersen: 100 }), 0)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 10000, diskonPersen: 150 }), 0, 'lebih dari 100% = 0')

// 3b. diskon NEGATIF = markup (member bayar LEBIH MAHAL)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 10000, diskonPersen: -20 }), 12000, 'markup 20%')
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 15000, diskonPersen: -10 }), 16500)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 10000, diskonPersen: -100 }), 20000, 'markup 100% = dobel')

// 4. Harga tetap menang penuh atas diskon %
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 20000, hargaTetap: 12000, diskonPersen: 50 }), 12000)

// 5. Harga tetap 0/null → abaikan (jangan override jadi 0)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 20000, hargaTetap: 0, diskonPersen: 10 }), 18000)
assert.strictEqual(hargaMemberEfektif({ hargaNormal: 20000, hargaTetap: null }), 20000)

// 6. mapHargaMemberEfektif menerjemahkan beberapa produk
const map = mapHargaMemberEfektif({
  1: { hargaNormal: 10000, diskonPersen: 10 },
  2: { hargaNormal: 10000, hargaTetap: 5000 },
  3: { hargaNormal: 10000 },
})
assert.deepStrictEqual(map, { 1: 9000, 2: 5000, 3: 10000 })

console.log('member-pricing: semua assert lolos ✔')
