import assert from 'node:assert'
import { generateProductBarcode, isInternalBarcode, ean13CheckDigit } from '../src/lib/barcode-code39.ts'

// generateProductBarcode selalu hasil internal
for (let id = 1; id <= 1000; id++) {
  const bc = generateProductBarcode(id)
  assert.match(bc, /^2\d{12}$/, `barcode harus 13 digit awalan 2: ${bc}`)
  assert.ok(isInternalBarcode(bc), `generateProductBarcode(${id}) harus terdeteksi internal: ${bc}`)
  // checksum EAN-13 valid
  assert.strictEqual(Number(ean13CheckDigit(bc.slice(0, 12))), Number(bc[12]), `ean13 check gagal: ${bc}`)
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
