// Test mandiri utk dual pricing — run:
//   node --experimental-strip-types tests/dual-pricing.test.mjs
import { hargaEfektif, isGrosir } from '../src/lib/dual-pricing.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('dual-pricing test:')

const p = { harga: 10000, harga_grosir: 8000, min_qty_grosir: 6 }

// Dibawah ambang → harga ecer
ok('qty 1 pakai ecer', hargaEfektif(p, 1) === 10000)
ok('qty 5 pakai ecer', hargaEfektif(p, 5) === 10000)
ok('isGrosir false qty 1', !isGrosir(p, 1))

// Sama / di atas ambang → harga grosir
ok('qty 6 pakai grosir', hargaEfektif(p, 6) === 8000)
ok('qty 12 pakai grosir', hargaEfektif(p, 12) === 8000)
ok('isGrosir true qty 6', isGrosir(p, 6))

// Produk tanpa harga grosir → selalu ecer
const noGrosir = { harga: 5000 }
ok('tanpa harga_grosir → ecer', hargaEfektif(noGrosir, 10) === 5000)
ok('tanpa harga_grosir isGrosir false', !isGrosir(noGrosir, 10))

// harga_grosir NULL tapi min ada → tetap ecer
const nullGrosir = { harga: 5000, harga_grosir: null, min_qty_grosir: 3 }
ok('harga_grosir null + min ada → ecer', hargaEfektif(nullGrosir, 3) === 5000)

// harga_grosir ada tapi min 0/NULL → selalu ecer (jaga-jaga)
const minNol = { harga: 5000, harga_grosir: 4000, min_qty_grosir: null }
ok('min null → ecer', hargaEfektif(minNol, 100) === 5000)

// harga grosir lebih mahal dari ecer (data salah) — jangan pakai grosir
const grosirMahal = { harga: 1000, harga_grosir: 2000, min_qty_grosir: 2 }
ok('harga_grosir > ecer → tetap ecer (anti data kacau)', hargaEfektif(grosirMahal, 5) === 1000)

console.log(`\nPASS: ${pass} assertion`);
