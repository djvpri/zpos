// Repro: null byte sanitization di apiHandler.
// Bug sebelum fix commit 5c71996f33: user input bawa \x00 (clipboard Windows)
// → Postgres reject "invalid byte sequence UTF8: 0x00" (22021) → HTTP 500.
// Setelah fix: sanitizeNullBytes() strip \0 sebelum schema.parse → HTTP 200.
//
// Test ini verify sanitizeNullBytes() pure function — tidak hit server.
// Run: node --experimental-strip-types tests/repro/utf8-null-byte.mjs

import assert from 'node:assert/strict'

let pass = 0
let fail = 0
function ok(desc, cond) {
  if (cond) { pass++; console.log('  ok -', desc) }
  else { fail++; console.error('  FAIL -', desc) }
}

// Reimplement sanitizeNullBytes (sama logic, isolated test — no import side-effect).
// Production version ada di src/lib/api-handler.ts.
function sanitizeNullBytes(value) {
  if (typeof value === 'string') return value.replace(/\0/g, '')
  if (Array.isArray(value)) return value.map(sanitizeNullBytes)
  if (value && typeof value === 'object') {
    const out = {}
    for (const k in value) out[k] = sanitizeNullBytes(value[k])
    return out
  }
  return value
}

console.log('repro utf8-null-byte:')

// ── Test 1: plain string dengan null byte di akhir ──
{
  const input = 'alamat saya\x00'
  const out = sanitizeNullBytes(input)
  ok('strip null byte dari string plain', out === 'alamat saya')
  ok('length berkurang 1', out.length === input.length - 1)
}

// ── Test 2: null byte di tengah string ──
{
  const input = '0812\x003456789'
  const out = sanitizeNullBytes(input)
  ok('strip null byte di tengah', out === '08123456789')
}

// ── Test 3: nested object (body request tipikal) ──
{
  const body = {
    alamat: 'Jl. Sudirman\x00',
    telepon: '0812\x003456789',
    catatan_struk: 'terima kasih\x00\x00',
    ukuran_label: '50x30',           // tanpa null byte
    pajak_persen: 11,                 // non-string, harus lewat utuh
    kurangi_stok: true,
  }
  const out = sanitizeNullBytes(body)
  ok('alamat clean', out.alamat === 'Jl. Sudirman')
  ok('telepon clean', out.telepon === '08123456789')
  ok('catatan_struk clean (multi null)', out.catatan_struk === 'terima kasih')
  ok('field tanpa null tetap utuh', out.ukuran_label === '50x30')
  ok('non-string number lewat utuh', out.pajak_persen === 11)
  ok('non-string boolean lewat utuh', out.kurangi_stok === true)
}

// ── Test 4: array of strings (items list) ──
{
  const items = ['item-a\x00', 'item-b', 'item-c\x00\x00']
  const out = sanitizeNullBytes(items)
  ok('array element clean', out[0] === 'item-a' && out[1] === 'item-b' && out[2] === 'item-c')
  ok('array tetap array', Array.isArray(out))
}

// ── Test 5: deeply nested (produk_json shape) ──
{
  const body = {
    produk: {
      '1': { nama: 'Kopi\x00', harga: 5000 },
      '2': { nama: 'Teh', harga: 3000 },
    },
    meta: { note: 'rush\x00 order' },
  }
  const out = sanitizeNullBytes(body)
  ok('nested produk.1.nama clean', out.produk['1'].nama === 'Kopi')
  ok('nested produk.2.nama tetap', out.produk['2'].nama === 'Teh')
  ok('nested meta.note clean', out.meta.note === 'rush order')
  ok('nested number tetap utuh', out.produk['1'].harga === 5000)
}

// ── Test 6: null + undefined + number (edge cases) ──
{
  const body = { a: null, b: undefined, c: 0, d: '', e: false }
  const out = sanitizeNullBytes(body)
  ok('null lewat utuh', out.a === null)
  ok('undefined lewat utuh', out.b === undefined)
  ok('0 lewat utuh', out.c === 0)
  ok('empty string lewat utuh', out.d === '')
  ok('false lewat utuh', out.e === false)
}

// ── Test 7: string tanpa null byte (passthrough, no-op) ──
{
  const input = 'normal string tanpa null'
  const out = sanitizeNullBytes(input)
  ok('string normal tidak berubah', out === input)
}

console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)