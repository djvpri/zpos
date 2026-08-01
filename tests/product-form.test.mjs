// Test mandiri utk validasi form produk (mode cepat) — NAMA wajib saja.
// run: node --experimental-strip-types tests/product-form.test.mjs
import { fieldKurang } from '../src/lib/product-form.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('product-form test:')

// Semua kosong → cuma Nama yang kurang (harga & kategori opsional)
const r = fieldKurang({ nama: '', harga: '', kategori_id: '' })
ok('semua kosong → 1 missing (Nama saja)', r.length === 1)
ok('sebut Nama Produk', r.includes('Nama Produk'))

// Nama kosong → Nama kurang, walau harga/kategori terisi
ok('nama kosong → Nama', fieldKurang({ nama: '', harga: '3500', kategori_id: 3 })[0] === 'Nama Produk')

// Nama ada, harga & kategori kosong (mode cepat) → VALID, tidak ada kurang
ok('nama saja → valid (harga & kategori opsional)', fieldKurang({ nama: 'Indomie', harga: '', kategori_id: '' }).length === 0)

// Lengkap → tetap valid
ok('lengkap → valid', fieldKurang({ nama: 'Indomie', harga: '3500', kategori_id: 3 }).length === 0)

// Harga 0 → TIDAK lagi dianggap kurang (opsional, default 1)
ok('harga 0 → tetap valid (tidak wajib)', fieldKurang({ nama: 'x', harga: 0, kategori_id: 1 }).length === 0)

// Kategori kosong → TIDAK lagi dianggap kurang
ok('kategori kosong → tetap valid (opsional)', fieldKurang({ nama: 'x', harga: '1', kategori_id: '' }).length === 0)
ok('kategori 0 → tetap valid (opsional)', fieldKurang({ nama: 'x', harga: '1', kategori_id: 0 }).length === 0)

// nama spasi saja → dianggap kosong
ok('nama spasi → kurang Nama', fieldKurang({ nama: '   ', harga: '1000', kategori_id: 1 }).includes('Nama Produk'))

console.log(`\nPASS: ${pass} assertion`)
