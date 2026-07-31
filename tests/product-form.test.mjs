// Test mandiri utk validasi form produk — run:
//   node --experimental-strip-types tests/product-form.test.mjs
import { fieldKurang } from '../src/lib/product-form.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('product-form test:')

// Semua kosong → ketiga field terdaftar
const r = fieldKurang({ nama: '', harga: '', kategori_id: '' })
ok('semua kosong → 3 missing', r.length === 3)
ok('sebut Nama Produk', r.includes('Nama Produk'))
ok('sebut Harga', r.includes('Harga'))
ok('sebut Kategori', r.includes('Kategori'))

// Nama diisi saja → Harga & Kategori kurang
const r2 = fieldKurang({ nama: 'Indomie', harga: '', kategori_id: '' })
ok('nama ada → Harga+Kategori', r2.length === 2 && r2.includes('Harga') && r2.includes('Kategori'))

// nama+harga ada, kategori kosong → hanya Kategori
const r3 = fieldKurang({ nama: 'Indomie', harga: '3500', kategori_id: '' })
ok('nama+harga → cuma Kategori', r3.length === 1 && r3[0] === 'Kategori')

// Lengkap → kosong (valid)
const r4 = fieldKurang({ nama: 'Indomie', harga: '3500', kategori_id: 3 })
ok('lengkap → valid (tidak ada kurang)', r4.length === 0)

// harga 0 / negatif dianggap kurang
ok('harga 0 → kurang Harga', fieldKurang({ nama: 'x', harga: 0, kategori_id: 1 }).includes('Harga'))
ok('harga negatif → kurang Harga', fieldKurang({ nama: 'x', harga: -5, kategori_id: 1 }).includes('Harga'))

// nama spasi saja → dianggap kosong
ok('nama spasi → kurang Nama', fieldKurang({ nama: '   ', harga: '1000', kategori_id: 1 }).includes('Nama Produk'))

// kategori_id 0 → falsy → dianggap kurang (bukan kategori valid)
ok('kategori 0 → kurang Kategori', fieldKurang({ nama: 'x', harga: '1', kategori_id: 0 }).includes('Kategori'))

console.log(`\nPASS: ${pass} assertion`)
