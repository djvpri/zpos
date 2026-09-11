// Test validasi item virtual katalog ("Lainnya").
//
// Kontrak yang dijaga: harga WAJIB angka >= 0. Baris virtual berharga 0 bikin
// Σ grup ≠ total bon — persis bug yang fitur katalog item virtual perbaiki.
// Karena itu entri cacat DITOLAK mentah-mentah, bukan diam-diam jadi 0.
//
// Jalankan: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validasiItemVirtual } from '../src/lib/item-virtual.ts'

test('nama+harga valid → diterima, nama di-trim', () => {
  const r = validasiItemVirtual({ nama: '  Ayam  ', harga: 20000 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.nilai, { nama: 'Ayam', harga: 20000 })
})

test('harga 0 DITERIMA — "harga bebas" memang sah (kasir isi saat jual)', () => {
  const r = validasiItemVirtual({ nama: 'Jasa Servis', harga: 0 })
  assert.equal(r.ok, true)
  assert.equal(r.nilai.harga, 0)
})

test('harga teks / NaN / negatif / null / bool / kosong DITOLAK', () => {
  // Number(null)=0, Number(true)=1, Number('')=0 — semuanya TIDAK boleh lolos
  // diam-diam jadi harga 0/1.
  for (const harga of ['abc', NaN, -1, null, Infinity, true, false, '', '  ', {}, []]) {
    const r = validasiItemVirtual({ nama: 'Ayam', harga })
    assert.equal(r.ok, false, `harga=${JSON.stringify(harga)} harus ditolak`)
  }
})

test('harga string angka DITERIMA (server terima form-encoded juga)', () => {
  const r = validasiItemVirtual({ nama: 'Ayam', harga: '20000' })
  assert.equal(r.ok, true)
  assert.equal(r.nilai.harga, 20000)
})

test('nama kosong / spasi / bukan string DITOLAK', () => {
  for (const nama of ['', '   ', undefined, null, 123]) {
    assert.equal(validasiItemVirtual({ nama, harga: 100 }).ok, false)
  }
})

test('body kosong / bukan objek DITOLAK (bukan crash)', () => {
  for (const body of [undefined, null, 'x', 5, []]) {
    assert.equal(validasiItemVirtual(body).ok, false)
  }
})

test('harga pecahan dibulatkan ke rupiah utuh', () => {
  const r = validasiItemVirtual({ nama: 'Ayam', harga: 20000.6 })
  assert.equal(r.ok, true)
  assert.equal(r.nilai.harga, 20001)
})

test('nama dipotong 120 char (batas kolom)', () => {
  const r = validasiItemVirtual({ nama: 'a'.repeat(300), harga: 1000 })
  assert.equal(r.ok, true)
  assert.equal(r.nilai.nama.length, 120)
})
