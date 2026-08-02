import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalisasiSubdomain, validSubdomain, normalisasiWa, isValidWa,
  formatPesanWa, waLink,
} from '../src/lib/toko-online.ts'

test('normalisasiSubdomain lowercase + strip', () => {
  assert.equal(normalisasiSubdomain('Warung-Bu-Sari'), 'warung-bu-sari')
  assert.equal(normalisasiSubdomain('https://toko.com/'), 'toko')
  assert.equal(normalisasiSubdomain('  si-A  '), 'si-a')
  assert.equal(normalisasiSubdomain('ma@kan!x'), 'ma-kan-x')
})

test('validSubdomain rule', () => {
  assert.equal(validSubdomain('warung').ok, true)
  assert.equal(validSubdomain('ab').ok, false)         // < 3
  assert.equal(validSubdomain('').ok, false)           // kosong
  assert.equal(validSubdomain('a b c').ok, false)      // spasi
  assert.equal(validSubdomain('toko-123').ok, true)    // angka + strip oke
})

test('normalisasiWa handles 08/8/62', () => {
  assert.equal(normalisasiWa('081234567890'), '6281234567890')
  assert.equal(normalisasiWa('81234567890'), '6281234567890')
  assert.equal(normalisasiWa('6281234567890'), '6281234567890')
  assert.equal(normalisasiWa('+62 812-3456'), '628123456')
})

test('isValidWa', () => {
  assert.equal(isValidWa('081234567890'), true)
  assert.equal(isValidWa('0812'), false) // terlalu pendek
})

test('formatPesanWa lines + total', () => {
  const msg = formatPesanWa(
    [{ nama: 'Kopi', qty: 2, harga: 5000 }, { nama: 'Gula', qty: 1, harga: 15000 }],
    { nama: 'Andi', alamat: 'Jl. Mawar' },
  )
  assert.ok(msg.includes('2× Kopi'))
  assert.ok(msg.includes('Total: Rp 25.000'))
  assert.ok(msg.includes('Nama: Andi'))
  assert.ok(msg.includes('Alamat: Jl. Mawar'))
})

test('waLink encodes', () => {
  const link = waLink('081234567890', 'Pesan Kopi 2x')
  assert.ok(link.startsWith('https://wa.me/6281234567890?text='))
  assert.ok(link.includes('Pesan%20Kopi'))
})
