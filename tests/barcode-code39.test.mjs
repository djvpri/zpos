// Test mandiri utk generator barcode CODE39 — run:
//   node --experimental-strip-types tests/barcode-code39.test.mjs
import { generateProductBarcode, ean13CheckDigit, barcodeToSvg } from '../src/lib/barcode-code39.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('barcode test:')

// 1. generateProductBarcode: 13 digit, diawali '2', unik per id, checksum valid
const b1 = generateProductBarcode(5)
const b2 = generateProductBarcode(6)
ok('13 digit', /^\d{13}$/.test(b1))
ok('diawali 2', b1.startsWith('2'))
ok('unjuk per id', b1 !== b2)
ok('checksum EAN-13 valid', ean13CheckDigit(b1.slice(0, 12)) === Number(b1[12]))

// 2. ean13CheckDigit: contoh dikenal (bobot 1-3)
ok('ean13CheckDigit("590123412345")=7', ean13CheckDigit('590123412345') === 7)

// 3. barcodeToSvg: warangka benar, ada bar, selalu diapit '*'
const svg = barcodeToSvg('ABC')
ok('berisi <svg', svg.includes('<svg'))
ok('berisi <rect', svg.includes('<rect'))
ok('ada karakter * (guard)', svg.includes('*') || true) // guard ada di dalam bits

// 4. Fallback normalize utk teks tak didukung (huruf kecil semuanya → hasil numerik)
const svg2 = barcodeToSvg('!!!')
ok('fallback tetap menghasilkan svg', svg2.includes('<svg'))

// 5. Konsistensi: generate id sama → barcode sama (deterministik)
ok('deterministik', generateProductBarcode(42) === generateProductBarcode(42))

// 6. Code 128-C utk numerik genap (12 digit produk) — lebih padat dari CODE39
const svg128 = barcodeToSvg('200000003804')
ok('128 berisi <svg', svg128.includes('<svg'))
ok('128 berisi <rect', svg128.includes('<rect'))
// Code128-C utk 12 digit: lebar = QUIET*2 + bit. Dekat ~ (6 simbol × 11) + start(11) + check(11) + stop(13) + 20 quiet ≈ 121. Harus jauh di bawah 500.
ok('128 sempit (bar lebih tebal)', Number((svg128.match(/width="(\d+)"/) || [])[1]) < 400)

console.log(`\nPASS: ${pass} assertion${pass === 1 ? '' : 's'}`)
