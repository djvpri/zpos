// Regresi: preset "Lainnya" (tabel item_virtual, id serial POSITIF) dipakai di bon
// web lewat id VIRTUAL NEGATIF hasil idVirtualPreset(). Kalau pemetaan ini salah,
// baris preset tampil "Produk #-..." atau bentrok dgn produk asli.
import assert from 'node:assert/strict'
import test from 'node:test'
import { idVirtualPreset, idItemVirtualDariPreset, normalVmap, grupDariSesi } from '../src/lib/bon-sesi.ts'

test('id preset selalu negatif & bisa dibalik', () => {
  for (const id of [1, 5, 6, 999, 123456]) {
    const v = idVirtualPreset(id)
    assert.ok(v < 0, `id virtual harus negatif (dapat ${v})`)
    assert.equal(idItemVirtualDariPreset(v), id, 'pemetaan bolak-balik')
  }
})

test('id preset tak bertabrakan dgn hash kasir (vidVirtual) di rentang nyata', () => {
  // vidVirtual kasir = -(hash 63-bit) — nilainya JAUH lebih besar dari 1e9.
  const hashKasirContoh = -6951839213252300 // contoh hash nama+harga
  const vWeb = idVirtualPreset(6)
  assert.notEqual(vWeb, hashKasirContoh)
  assert.ok(Math.abs(vWeb) < 1e10, 'id web tetap di rentang kecil (1e9..)')
})

test('garis preset di nota dapat nama & harga dari vmap', () => {
  const idVirtual = idVirtualPreset(6)             // preset "Ayam Preset" harga 20.000
  const vmap = normalVmap({ [String(idVirtual)]: { nama: 'Ayam Preset', harga: 20000 } })
  assert.equal(vmap[String(idVirtual)].nama, 'Ayam Preset', 'id web harus diterima normalVmap')
  assert.equal(vmap[String(idVirtual)].harga, 20000)

  // Bon: grup 1 = 1 produk asli, grup 2 = 2 preset (kiriman kedua)
  const sesi = [
    { t: '2026-09-11T01:00:00.000Z', p: { '175': 1 }, h: { '175': 21000 } },
    { t: '2026-09-11T05:00:00.000Z', p: { [String(idVirtual)]: 2 }, h: { [String(idVirtual)]: 20000 } },
  ]
  const final = { '175': 1, [String(idVirtual)]: 2 }
  const namaDari = (id) => id < 0 ? vmap[String(id)]?.nama : ({ 175: 'Ayam Geprek' })[id]
  const hargaDari = (id) => id < 0 ? vmap[String(id)]?.harga : 21000
  const grup = grupDariSesi(sesi, final, namaDari, hargaDari)
  assert.ok(grup, 'nota harus tetap terpisah per grup')
  assert.equal(grup[1].items[0].nama, 'Ayam Preset')
  assert.equal(grup[1].subtotal, 40000)
  assert.equal(grup.reduce((s, g) => s + g.subtotal, 0), 21000 + 40000)
})

test('normalVmap tetap menolak id positif (produk asli tak boleh jadi vmap)', () => {
  const v = normalVmap({ '6': { nama: 'Ayam Preset', harga: 20000 } })
  assert.deepEqual(v, {}, 'id item_virtual mentah (positif) tak boleh lolos')
})
