// Test mandiri utk desain nota — run:
//   node --experimental-strip-types tests/desain-nota.test.mjs
import { DESAIN_NOTA, desainNotaIds, getDesainNota } from '../src/lib/desain-nota.ts'
import assert from 'node:assert'

let pass = 0
function ok(desc, cond) { assert.ok(cond, desc); pass++; console.log('  ok -', desc) }

console.log('desain-nota test:')

// 1. klasik2 terdaftar di DESAIN_NOTA & divalidasi (dropdown + API otomatis ikut)
ok('klasik2 ada di desainNotaIds', desainNotaIds.includes('klasik2'))
ok('desainNotaIds == jumlah DESAIN_NOTA', desainNotaIds.length === DESAIN_NOTA.length)

// 2. klasik2 = klasik + showHargaSatuan (fitur baru), tanpa mengubah desain lain
const k2 = getDesainNota('klasik2')
ok('klasik2 label Klasik 2', k2.label === 'Klasik 2')
ok('klasik2 infoSebelumItems sama klasik', k2.infoSebelumItems === true)
ok('klasik2 totalPertama sama klasik (false)', k2.totalPertama === false)
ok('klasik2 divider dashed', k2.dividerStyle === 'dashed')
ok('klasik2 showKsr true', k2.showKsr === true)
ok('klasik2 showHargaSatuan TRUE', k2.showHargaSatuan === true)

// 3. showHargaSatuan default FALSE utk desain lain (tidak terpengaruh)
ok('klasik showHargaSatuan false', getDesainNota('klasik').showHargaSatuan === false)
ok('modern showHargaSatuan false', getDesainNota('modern').showHargaSatuan === false)

// 4. Fallback tak dikenal → klasik (default aman)
ok('getDesainNota(null) default klasik', getDesainNota(null).id === 'klasik')
ok('getDesainNota("xyz") fallback klasik', getDesainNota('xyz').id === 'klasik')

console.log(`\nPASS: ${pass} assertion${pass === 1 ? '' : 's'}`)
