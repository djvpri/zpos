// Regresi: modal edit bon kirim `sesi` bentuk ADITIF (p = qty kiriman grup itu,
// bukan snapshot kumulatif) + `h` harga saat itu. Server memakai `sesiIn` apa
// adanya bila tak kosong — jadi bentuk ini yang menentukan riwayat harga per grup.
import assert from 'node:assert/strict'
import test from 'node:test'
import { normalSesi, grupDariSesi, resolveSesi } from '../src/lib/bon-sesi.ts'

// Tiru susunan `sesi` yang dibangun BonEditModal.simpanKe() dari grup di UI.
function sesiDariModal(grup) {
  const bersih = grup
    .map(g => ({ t: g.t, baris: g.baris.filter(b => b.produk_id !== 0 && b.qty > 0) }))
    .filter(g => g.baris.length > 0)
  return bersih.map(g => ({
    t: g.t ?? new Date().toISOString(),
    p: Object.fromEntries(g.baris.map(b => [String(b.produk_id), b.qty])),
    h: Object.fromEntries(g.baris.map(b => [String(b.produk_id), Math.round(b.harga)])),
  }))
}

const namaDari = (id) => ({ 175: 'Ayam Geprek', 184: 'Beras 5kg', 190: 'Es Teh' })[id] ?? `#${id}`

test('modal kirim sesi aditif: grup lama tetap harganya, ubah harga grup lama ikut tersimpan', () => {
  // User membuka bon #103 (4 grup) lalu MENGUBAH harga grup 3 dari 15.000 -> 16.000.
  const grup = [
    { t: '2026-09-09T14:41:41.200Z', baris: [{ produk_id: 175, nama: 'Ayam Geprek', harga: 21000, qty: 1 }] },
    { t: '2026-09-10T15:36:06.000Z', baris: [{ produk_id: 175, nama: 'Ayam Geprek', harga: 21000, qty: 2 }] },
    { t: '2026-09-10T15:55:57.000Z', baris: [{ produk_id: 175, nama: 'Ayam Geprek', harga: 16000, qty: 2 }] },
  ]
  const sesi = normalSesi(sesiDariModal(grup))
  assert.equal(sesi.length, 3)
  assert.deepEqual(sesi.map(s => s.p['175']), [1, 2, 2], 'ADITIF: qty kiriman, bukan kumulatif 1/3/5')
  assert.deepEqual(sesi.map(s => s.h['175']), [21000, 21000, 16000], 'harga per grup tersimpan')

  const final = { '175': 5 }
  const g = grupDariSesi(sesi, final, namaDari, () => 0)
  assert.ok(g, 'nota tetap bisa memisah per grup')
  assert.deepEqual(g.map(x => x.items[0].harga), [21000, 21000, 16000])
  assert.equal(g.reduce((s, x) => s + x.subtotal, 0), 1 * 21000 + 2 * 21000 + 2 * 16000)
})

test('modal tambah grup baru: sesi bertambah satu, total konsisten', () => {
  const grup = [
    { t: '2026-09-11T01:00:00.000Z', baris: [{ produk_id: 175, nama: 'Ayam Geprek', harga: 22000, qty: 1 }] },
    { t: '2026-09-11T05:00:00.000Z', baris: [{ produk_id: 190, nama: 'Es Teh', harga: 5000, qty: 3 }] },
  ]
  const sesi = normalSesi(sesiDariModal(grup))
  assert.equal(sesi.length, 2)
  const final = { '175': 1, '190': 3 }
  const g = grupDariSesi(sesi, final, namaDari, () => 0)
  assert.ok(g)
  assert.equal(g.reduce((s, x) => s + x.subtotal, 0), 22000 + 15000)
})

test('modal buang grup: grup kosong tak ikut terkirim', () => {
  const grup = [
    { t: '2026-09-11T01:00:00.000Z', baris: [{ produk_id: 175, nama: 'Ayam Geprek', harga: 22000, qty: 1 }] },
    { t: '2026-09-11T05:00:00.000Z', baris: [] }, // user hapus semua isinya
  ]
  const sesi = normalSesi(sesiDariModal(grup))
  assert.equal(sesi.length, 1, 'grup kosong dibuang')
  assert.deepEqual(sesi[0].p, { '175': 1 })
})

test('bon lama tanpa grup (items flat) -> satu grup dari created_at', () => {
  const n = resolveSesi(null, JSON.stringify({ '175': 1, '184': 1 }), '2026-09-11T01:00:00.000Z')
  assert.equal(n.length, 1)
  assert.deepEqual(n[0].p, { '175': 1, '184': 1 })
  assert.equal(n[0].t, '2026-09-11T01:00:00.000Z')
})
