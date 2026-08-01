// Test mandiri utk helper nama unik di upload foto massal (barang mirip beda ukuran).
// run: node --experimental-strip-types tests/nama-unik.test.mjs
import { namaUnikDari } from '../src/lib/nama-unik.ts'
import assert from 'node:assert'

let n = 0
const t = (name, fn) => { fn(); n++ }

// Nama belum dipakai → tetap apa adanya
t('nama baru tetap', () => assert.equal(namaUnikDari('Sepatu Adidas', new Set(['Indomie'])), 'Sepatu Adidas'))

// Nama sudah dipakai → append angka 2
t('dedup jadi "2"', () => assert.equal(namaUnikDari('Sepatu Adidas', new Set(['Sepatu Adidas'])), 'Sepatu Adidas 2'))

// "2" juga dipakai → jadi "3"
t('dedup skip angka terpakai', () => assert.equal(
  namaUnikDari('Sepatu Adidas', new Set(['Sepatu Adidas', 'Sepatu Adidas 2'])),
  'Sepatu Adidas 3'
))

// Deret penuh: 2,3,...,6 semua dipakai → jadi 7
const banyak = new Set(['Sepatu Adidas', 'Sepatu Adidas 2', 'Sepatu Adidas 3', 'Sepatu Adidas 4', 'Sepatu Adidas 5', 'Sepatu Adidas 6'])
t('dedup seri panjang', () => assert.equal(namaUnikDari('Sepatu Adidas', banyak), 'Sepatu Adidas 7'))

// Nama kosong (Gemini gagal) — helper harus tetap aman
t('nama kosong', () => assert.equal(namaUnikDari('', new Set([])), ''))

console.log(`PASS: ${n} assertions`)
