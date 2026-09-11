// Regresi tombol edit bon gantung di web (PATCH /api/bon/:id TANPA `sesi`).
//
// Bug lama: server memanggil appendSesi(before, now, finalObj) -> grup baru berisi
// snapshot KUMULATIF (qty SELURUH bon) & TANPA harga. Akibatnya:
//   - Σ qty per id jadi dobel (grup1 1 + grup2 2 = 3, padahal final 2)
//   - grup lama/tanpa-h bercampur -> grupDariSesi() balik null, nota kehilangan
//     pemisahan per grup (persis keluhan "timestamp semua sama" + harga per grup hilang)
//
// Fix: sesiDariEdit() menurunkan qty berlebih (LIFO), menaikkan yg kurang sebagai
// DELTA di grup baru (ber-harga), dan memperbarui `h` bila hanya harga yg berubah.
import assert from 'node:assert/strict'
import test from 'node:test'
import { sesiDariEdit, grupDariSesi } from '../src/lib/bon-sesi.ts'

const T1 = '2026-09-11T01:00:00.000Z'
const T2 = '2026-09-11T05:00:00.000Z'

const base = () => ([
  { t: T1, p: { '175': 1, '184': 1 }, h: { '175': 22000, '184': 65000 } },
])

test('edit tambah qty: grup baru berisi DELTA + harga, bukan snapshot kumulatif', () => {
  const out = sesiDariEdit(base(), T2, { '175': 2, '184': 1 }, { '175': 22000, '184': 65000 })
  assert.equal(out.length, 2)
  assert.deepEqual(out[1].p, { '175': 1 }, 'grup baru = delta saja (1), bukan 2')
  assert.equal(out[1].h['175'], 22000, 'grup baru wajib ber-harga')
  // Σ qty harus sama dgn final
  const jum = {}
  for (const s of out) for (const [id, q] of Object.entries(s.p)) jum[id] = (jum[id] ?? 0) + Number(q)
  assert.deepEqual(jum, { '175': 2, '184': 1 })
})

test('edit tambah item BARU: masuk grup baru, item lama tetap di grup lama', () => {
  const out = sesiDariEdit(base(), T2, { '175': 1, '184': 1, '190': 3 }, { '190': 5000 })
  assert.equal(out.length, 2)
  assert.deepEqual(out[1].p, { '190': 3 })
  assert.equal(out[1].h['190'], 5000)
  assert.deepEqual(out[0].p, { '175': 1, '184': 1 }, 'grup lama tak berubah')
})

test('edit kurang qty: ditarik dari grup terbaru (LIFO), grup lama tetap', () => {
  const sebelum = [
    { t: T1, p: { '175': 2 }, h: { '175': 22000 } },
    { t: T2, p: { '175': 3 }, h: { '175': 15000 } },
  ]
  const out = sesiDariEdit(sebelum, T2, { '175': 4 }, null)
  assert.deepEqual(out.map(s => s.p), [{ '175': 2 }, { '175': 2 }], 'diambil dari grup terakhir')
  assert.equal(out[1].h['175'], 15000)
})

test('edit buang item: grup jadi kosong dibuang', () => {
  const sebelum = [
    { t: T1, p: { '175': 1 }, h: { '175': 22000 } },
    { t: T2, p: { '184': 1 }, h: { '184': 65000 } },
  ]
  const out = sesiDariEdit(sebelum, T2, { '175': 1 }, null)
  assert.equal(out.length, 1)
  assert.deepEqual(out[0].p, { '175': 1 })
})

test('edit harga saja (qty tetap): TIDAK tambah grup, h diperbarui', () => {
  const out = sesiDariEdit(base(), T2, { '175': 1, '184': 1 }, { '175': 25000, '184': 65000 })
  assert.equal(out.length, 1, 'tak boleh ada grup baru')
  assert.equal(out[0].h['175'], 25000, 'harga grup lama diperbarui')
})

test('tanpa perubahan: sesi lama dipertahankan apa adanya', () => {
  const out = sesiDariEdit(base(), T2, { '175': 1, '184': 1 }, null)
  assert.deepEqual(out, base())
})

test('hasil sesiDariEdit tetap terbaca grupDariSesi (nota per-grup utuh)', () => {
  const sebelum = [
    { t: T1, p: { '175': 1, '184': 1 }, h: { '175': 21000, '184': 65000 } },
    { t: '2026-09-10T15:36:06.000Z', p: { '175': 2, '184': 1 }, h: { '175': 21000, '184': 65000 } },
  ]
  // Edit web: kurangi 184 jadi 1 & tambah 175 jadi 4 -> tetap harus punya `h` semua.
  const sesi = sesiDariEdit(sebelum, T2, { '175': 4, '184': 1 }, { '175': 15000, '184': 65000 })
  const nama = (id) => ({ 175: 'Ayam Geprek', 184: 'Beras 5kg' })[id]
  const grup = grupDariSesi(sesi, { '175': 4, '184': 1 }, nama, () => 0)
  assert.ok(grup, 'grupDariSesi harus mengembalikan grup, bukan null')
  const ayam = grup.flatMap(g => g.items).filter(i => i.produk_id === 175)
  assert.equal(ayam.reduce((s, i) => s + i.qty, 0), 4, 'total qty ayam harus 4, bukan dobel')
  // Harga PER-SESI dipertahankan: grup lama 21.000 (1+2), grup baru 15.000 (1).
  assert.equal(grup.reduce((s, g) => s + g.subtotal, 0), 1 * 21000 + 1 * 65000 + 2 * 21000 + 1 * 15000)
})
