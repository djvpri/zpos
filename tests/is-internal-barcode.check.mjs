import assert from 'node:assert'
import { generateProductBarcode, isInternalBarcode, eanCheckDigit, ean13CheckDigit } from '../src/lib/barcode-code39.ts'

// generateProductBarcode selalu hasil internal (format v4, 8 digit)
for (let id = 1; id <= 1000; id++) {
  const bc = generateProductBarcode(id)
  assert.match(bc, /^2\d{7}$/, `barcode harus 8 digit awalan 2: ${bc}`)
  assert.ok(isInternalBarcode(bc), `generateProductBarcode(${id}) harus terdeteksi internal: ${bc}`)
  // checksum EAN valid
  assert.strictEqual(Number(eanCheckDigit(bc.slice(0, 7))), Number(bc[7]), `ean check gagal: ${bc}`)
}

// non-internal: kosong, null, awalan lain, panjang beda
assert.strictEqual(isInternalBarcode(null), false)
assert.strictEqual(isInternalBarcode(undefined), false)
assert.strictEqual(isInternalBarcode(''), false)
assert.strictEqual(isInternalBarcode('8991234567890'), false, 'barcode real Indonesia')
assert.strictEqual(isInternalBarcode('123'), false)
assert.strictEqual(isInternalBarcode('2abcd12345678'), false, 'non-digit')


// false-positive check: angka real mulai 2 dengan checksum ean13 salah → bukan internal
assert.strictEqual(isInternalBarcode('2000000000000'), Number(ean13CheckDigit('200000000000')) === 0)

console.log('OK: semua assertion isInternalBarcode lulus')
