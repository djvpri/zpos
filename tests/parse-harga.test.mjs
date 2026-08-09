// Test parsing harga dari Gemini (parseHarga) — run:
//   node --experimental-strip-types tests/parse-harga.test.mjs
import assert from 'node:assert'
import { parseHarga } from '../src/lib/gemini-nama-produk.ts'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('parseHarga test:')

// number langsung, valid
ok('3000 → 3000', parseHarga(3000) === 3000)
ok('3000.7 → dibulatkan 3001', parseHarga(3000.7) === 3001)
// string format Rupiah
ok('"Rp3.500" → 3500', parseHarga('Rp3.500') === 3500)
ok('"Rp 7 500" → 7500', parseHarga('Rp 7 500') === 7500)
ok('"harga 7500" → 7500', parseHarga('harga 7500') === 7500)
ok('"12.000" → 12000', parseHarga('12.000') === 12000)
// tak valid / nol / negatif
ok('-5 → null', parseHarga(-5) === null)
ok('0 → null', parseHarga(0) === null)
ok('"-" → null', parseHarga('-') === null)
ok('"Rp" → null', parseHarga('Rp') === null)
ok('"dua ribu" → null (bukan angka)', parseHarga('dua ribu') === null)
ok('"" → null', parseHarga('') === null)
ok('null → null', parseHarga(null) === null)
ok('undefined → null', parseHarga(undefined) === null)
ok('{obj} → null', parseHarga({ a: 1 }) === null)
ok('Infinity → null', parseHarga(Infinity) === null)
// batas: tidak menerima negatif walau string
ok('"-3500" → null (negatif tak valid)', parseHarga('-3500') === null)

console.log(`\nPASS: ${pass} assertion`)
