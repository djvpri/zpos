// Test mandiri utk deteksi nama produk dari foto (Gemini) — run:
//   node --experimental-strip-types tests/gemini-nama-produk.test.mjs
import assert from 'node:assert'
import { deteksiNamaDariFoto } from '../src/lib/gemini-nama-produk.ts'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('gemini-nama-produk test:')

// 1. Tanpa API key (env kosong) → graceful, TIDAK fetch, error jelas.
const seeded = (process.env.GEMINI_API_KEY || undefined)
delete process.env.GEMINI_API_KEY
const r1 = await deteksiNamaDariFoto('data:image/jpeg;base64,abc')
ok('tanpa key → nama null (bukan throw)', r1.nama === null)
ok('tanpa key → error menyebut GEMINI_API_KEY', typeof r1.error === 'string' && r1.error.includes('GEMINI_API_KEY'))
if (seeded) process.env.GEMINI_API_KEY = seeded

// 2. Foto bukan data:image → route yang menolak; fungsi sendiri tak validasi,
//    tapi pastikan jalan (tidak throw) — key dummy, pasti fetch gagal → error ter-return.
const oldKey = process.env.GEMINI_API_KEY
process.env.GEMINI_API_KEY = 'AIzaDUMMY'
const r2 = await deteksiNamaDariFoto('bukan-data-uri')
ok('foto non-data-uri + key dummy → return error (tidak throw)', r2.error !== undefined)
if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey

console.log(`\nPASS: ${pass} assertion`)
