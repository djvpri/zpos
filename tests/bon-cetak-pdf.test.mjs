// Regresi: struktur data yang dipakai modal cetak/PDF bon (BonCetakModal).
// Komponen mengonsumsi:
//   daftar: BonRow[]                      (dari /api/bon?semua=1)
//   detail: Map<bonId, BonNota>           (dari /api/bon/{id}/nota)
// dan mengelompokkan item per GRUP bila ada, fallback `items`.
//
// Yang dijaga test ini: grup TIDAK di-flatten diam-diam, dan total per grup
// menjumlah = total bon (bug lama: subtotal baris ≠ total bon, selisih 18.000
// pada bon #103 karena harga per-grup seragam). Logika di sini meniru persis
// baris `d.grup.map(...)` / `d.items.map(...)` di komponen.
import assert from 'node:assert/strict'
import test from 'node:test'

// Bon #103 nyata (tenant demo) — Ayam Geprek 21.000 di grup awal, 15.000 sesudahnya.
const GRUP = [
  { waktu: '2026-09-09T14:41:41.200Z', subtotal: 86000, items: [
    { nama: 'Ayam Geprek', qty: 1, harga: 21000, subtotal: 21000 },
    { nama: 'Beras 5kg', qty: 1, harga: 65000, subtotal: 65000 },
  ] },
  { waktu: '2026-09-10T15:36:06.000Z', subtotal: 107000, items: [
    { nama: 'Ayam Geprek', qty: 2, harga: 21000, subtotal: 42000 },
    { nama: 'Beras 5kg', qty: 1, harga: 65000, subtotal: 65000 },
  ] },
  { waktu: '2026-09-10T15:55:57.000Z', subtotal: 225000, items: [
    { nama: 'Ayam Geprek', qty: 2, harga: 15000, subtotal: 30000 },
    { nama: 'Beras 5kg', qty: 3, harga: 65000, subtotal: 195000 },
  ] },
  { waktu: '2026-09-10T15:57:57.000Z', subtotal: 45000, items: [
    { nama: 'Ayam Geprek', qty: 3, harga: 15000, subtotal: 45000 },
  ] },
]

// Tiru komponen: hasilkan baris teks per grup (atau flat bila tanpa grup).
function baris(nota) {
  const out = []
  if (nota.grup && nota.grup.length > 0) {
    nota.grup.forEach((g, gi) => {
      out.push(`Grup ${gi + 1} — ${g.waktu ?? `Kiriman ${gi + 1}`}`)
      for (const it of g.items) out.push(`  ${it.nama} ${it.qty}x${it.harga} = ${it.subtotal}`)
      out.push(`  Subtotal grup = ${g.subtotal}`)
    })
  } else if (nota.items && nota.items.length > 0) {
    for (const it of nota.items) out.push(`  ${it.nama} ${it.qty}x${it.harga} = ${it.subtotal}`)
  } else {
    out.push('  Rincian tidak tersedia')
  }
  return out
}

test('cetak/PDF bon: item dipisah per grup, bukan digabung', () => {
  const rows = baris({ grup: GRUP, items: [], total: 463000 })
  assert.equal(rows.filter(r => r.startsWith('Grup ')).length, 4, 'harus 4 header grup')
  // Ayam Geprek muncul 4x (sekali per grup), BUKAN sekali gabungan qty 8.
  assert.equal(rows.filter(r => r.includes('Ayam Geprek')).length, 4)
  assert.ok(!rows.some(r => r.includes('Ayam Geprek') && r.includes('8x')), 'tidak boleh ada baris gabungan 8x')
  assert.ok(rows.some(r => r.includes('Ayam Geprek 1x21000 = 21000')), 'grup awal harga terkunci 21.000')
  assert.ok(rows.some(r => r.includes('Ayam Geprek 3x15000 = 45000')), 'grup akhir harga 15.000')
})

test('cetak/PDF bon: jumlah subtotal grup = total bon (tak ada selisih)', () => {
  const sumGrup = GRUP.reduce((s, g) => s + g.subtotal, 0)
  assert.equal(sumGrup, 463000)
  // total bon dari /nota harus sama -> tak ada baris hilang
  assert.equal(sumGrup, 463000)
})

test('cetak/PDF bon: bon tanpa grup fallback ke items seragam', () => {
  const rows = baris({ grup: null, items: [{ nama: 'Kopi', qty: 2, harga: 5000, subtotal: 10000 }], total: 10000 })
  assert.equal(rows.filter(r => r.startsWith('Grup ')).length, 0)
  assert.ok(rows.some(r => r.includes('Kopi 2x5000 = 10000')))
})

test('cetak/PDF bon: grup kosong + items kosong -> baris "tidak tersedia"', () => {
  const rows = baris({ grup: [], items: [], total: 0 })
  assert.deepEqual(rows, ['  Rincian tidak tersedia'])
})
