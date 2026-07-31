// Test mandiri utk Barcode Lookup Open Food Facts — run:
//   node --experimental-strip-types tests/barcode-lookup.test.mjs
import { isBarcodeValid, lookupBarcode } from '../src/lib/barcode-lookup.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('barcode-lookup test:')

// 1. Validasi format
ok('terima EAN-13', isBarcodeValid('8991002102228'))
ok('terima EAN-8', isBarcodeValid('12345678'))
ok('tolak alfabet', !isBarcodeValid('ABC12345'))
ok('tolak >13 digit', !isBarcodeValid('12345678901234'))
ok('tolak pendek (<8)', !isBarcodeValid('1234'))

// 2. Live lookup: barcode global yang TERDAFTAR di OFP → ada nama
const global = await lookupBarcode('737628064502') // Thai peanut noodle kit (terdaftar)
ok('barcode global terdaftar → ada nama', global !== null && !!global.nama)
if (global) console.log('    contoh nama:', global.nama, '| merek:', global.merek)

// 3. Live lookup: barcode lokal Indonesia (umumnya TIDAK di OFP) → null
const lokal = await lookupBarcode('8991002102228')
ok('barcode lokal (899...) → null (tidak terdaftar)', lokal === null)

console.log(`\nPASS: ${pass} assertion`);
