// Check mandiri helper foto → Blob utk deteksi duplikat — run:
//   node --experimental-strip-types tests/duplikat-foto.check.mjs
import assert from 'node:assert'
import { fotoKeBlob } from '../src/lib/duplikat-blob.ts'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('duplikat-blob check:')

// fotoKeBlob: data URI base64 (1x1 png) → Blob dengan tipe benar
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const b = await fotoKeBlob(png)
ok('data URI → Blob', b instanceof Blob)
ok('Blob tipe image/png', b.type === 'image/png')

// null / bukan data / bukan http → null
ok('null → null', (await fotoKeBlob(null)) === null)
ok('string kosong → null', (await fotoKeBlob('')) === null)
ok('teks biasa → null', (await fotoKeBlob('abc')) === null)

// URL http gagal (server tak ada) → null, TIDAK throw
globalThis.fetch = async () => ({ ok: false })
const h = await fotoKeBlob('https://example.invalid/x.jpg')
ok('http res tak ok → null', h === null)
globalThis.fetch = undefined

console.log(`\nPASS: ${pass} assertion`)
