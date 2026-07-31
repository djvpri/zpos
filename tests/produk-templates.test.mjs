// Test mandiri utk data template produk — run:
//   node --experimental-strip-types tests/produk-templates.test.mjs
import { PRODUK_TEMPLATES } from '../src/lib/produk-templates.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('template test:')

// 1. Ada beberapa template
ok('ada >= 3 template', PRODUK_TEMPLATES.length >= 3)
ok('tipe id string unik', new Set(PRODUK_TEMPLATES.map(t => t.id)).size === PRODUK_TEMPLATES.length)

for (const t of PRODUK_TEMPLATES) {
  // 2. Tiap template punya produk
  ok(`[${t.nama}] ada produk`, t.produk.length > 0)

  // 3. Semua produk punya nama & harga > 0, stok >= 0
  for (const p of t.produk) {
    assert.ok(p.nama && p.nama.trim(), `[${t.nama}] nama kosong`)
    assert.ok(p.harga > 0, `[${t.nama}] ${p.nama}: harga harus > 0`)
    assert.ok(p.stok >= 0, `[${t.nama}] ${p.nama}: stok >= 0`)
    assert.ok(p.kategori === t.nama, `[${t.nama}] kategori harus sama`)
  }
  pass++

  // 4. Tidak ada nama duplikat dalam satu template
  const namaSet = new Set(t.produk.map(p => p.nama.toLowerCase()))
  ok(`[${t.nama}] nama produk unik`, namaSet.size === t.produk.length)
}

console.log(`\nPASS: ${pass} block assertion (${PRODUK_TEMPLATES.reduce((s,t)=>s+t.produk.length,0)} produk)`);
