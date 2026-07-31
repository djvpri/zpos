// Test mandiri untuk parser produk teks (parse-produk-teks.ts) — run tanpa framework:
//   node --experimental-strip-types tests/parse-produk-teks.test.mjs
import { parseLine, parseText } from '../src/lib/parse-produk-teks.ts'
import assert from 'node:assert'

let pass = 0
function eq(desc, actual, expected) {
  assert.deepStrictEqual(actual, expected, desc)
  pass++
  console.log('  ok -', desc)
}

console.log('parser test:')

eq('pemisah | penuh',
  parseLine('Indomie Goreng | 3500 | 100 | Makanan'),
  { nama: 'Indomie Goreng', harga: 3500, stok: 100, kategori: 'Makanan' })

eq('pemisah | 3 kolom',
  parseLine('Aqua 600ml | 3000 | 50'),
  { nama: 'Aqua 600ml', harga: 3000, stok: 50, kategori: '' })

eq('spasi nama+harga+stok',
  parseLine('Teh Botol Sosro 4000 20'),
  { nama: 'Teh Botol Sosro', harga: 4000, stok: 20, kategori: '' })

eq('nama saja',
  parseLine('Kerupuk'),
  { nama: 'Kerupuk', harga: 0, stok: 0, kategori: '' })

eq('angkanya bagian nama (600ml)',
  parseLine('Aqua 600ml 3000'),
  { nama: 'Aqua 600ml', harga: 3000, stok: 0, kategori: '' })

assert.strictEqual(parseLine('   '), null, 'baris kosong -> null')
assert.strictEqual(parseLine(''), null, 'baris empty -> null')
pass++

const items = parseText('Indomie Goreng | 3500 | 100 | Makanan\n\nTeh Botol Sosro 4000 20')
assert.strictEqual(items.length, 2, 'parseText length 2, baris kosong di-skip')
assert.strictEqual(items[0].nama, 'Indomie Goreng')
assert.strictEqual(items[1].harga, 4000)
pass++

console.log(`\nPASS: ${pass} assertion${pass === 1 ? '' : 's'}`)
