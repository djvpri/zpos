// Regresi: edit cepat harga (`PUT /api/produk/:id` body `{id, harga}`) TIDAK boleh
// menimpa stok jadi 0.
//
// Bug nyata: `produkUpdateSchema = produkSchema.partial()` — di Zod 4 `.partial()`
// TIDAK membuang `.default()`, jadi parse `{id, harga}` menyuntik `stok: 0` +
// `stok_minimum: 5` + `jenis: 'fisik'` → server SET stok = 0.
//
// Skema di sini = salinan 1:1 dari src/lib/validation.ts (node --test tak resolve
// alias `@/lib`). Kalau validation.ts berubah, uji ini harus ikut disesuaikan —
// test 1 di bawah yang menangkap regresinya.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'

const produkSchema = z.object({
  nama: z.string().min(1, 'Nama produk wajib diisi'),
  harga: z.number().positive('Harga harus lebih dari 0'),
  stok: z.number().int().min(0).default(0),
  stok_minimum: z.number().int().min(0).default(5),
  jenis: z.enum(['fisik', 'digital']).default('fisik'),
})

// Cermin dari src/lib/validation.ts — field ber-default di-override jadi `.optional()`.
const produkUpdateSchema = produkSchema.partial().extend({
  id: z.number().int().positive(),
  aktif: z.boolean().optional(),
  stok: z.number().int().min(0).optional(),
  stok_minimum: z.number().int().min(0).optional(),
  jenis: z.enum(['fisik', 'digital']).optional(),
})

test('BUG ASAL: partial() saja (tanpa override) menyuntik stok:0', () => {
  const naif = produkSchema.partial().extend({ id: z.number().int().positive() })
  const p = naif.parse({ id: 1, harga: 500 })
  assert.equal(p.stok, 0, 'bukti bug: partial() Zod4 pertahankan default')
  assert.equal(p.jenis, 'fisik')
})

test('FIX: skema update tak menyuntik field absen', () => {
  const p = produkUpdateSchema.parse({ id: 1, harga: 500 })
  assert.equal(p.stok, undefined, 'stok WAJIB undefined kalau tak dikirim')
  assert.equal(p.jenis, undefined, 'jenis WAJIB undefined kalau tak dikirim')
  assert.equal(p.stok_minimum, undefined, 'stok_minimum WAJIB undefined kalau tak dikirim')
})

test('edit stok eksplisit tetap diterima (termasuk 0)', () => {
  assert.equal(produkUpdateSchema.parse({ id: 7, stok: 12 }).stok, 12)
  assert.equal(produkUpdateSchema.parse({ id: 7, stok: 0 }).stok, 0)
})

test('stok negatif ditolak', () => {
  assert.throws(() => produkUpdateSchema.parse({ id: 7, stok: -3 }))
})

// Tiruan logika server (api/produk/[id] PUT) sesudah fix.
const stokServer = (existing, body) => {
  const merged = { ...existing, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) }
  return body.stok !== undefined
    ? (merged.jenis === 'digital' ? 0 : merged.stok)
    : (Number(existing.stok) || 0)
}

test('server: edit harga → stok existing dipertahankan', () => {
  const existing = { nama: 'Ayam', harga: 21000, stok: 42, jenis: 'fisik' }
  const body = produkUpdateSchema.parse({ id: 1, harga: 25000 })
  assert.equal(stokServer(existing, body), 42, 'stok HARUS tetap 42')
})

test('server: produk digital dipaksa stok 0 saat stok dikirim', () => {
  const existing = { nama: 'Pulsa', harga: 10000, stok: 0, jenis: 'digital' }
  const body = produkUpdateSchema.parse({ id: 1, stok: 5 })
  assert.equal(stokServer(existing, body), 0)
})
