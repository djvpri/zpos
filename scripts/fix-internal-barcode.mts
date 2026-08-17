// One-shot: perbaiki barcode internal ZPos yang checksum-nya Luhn (lama) jadi
// EAN-13 yang benar supaya scanner + label barcode bisa baca.
//
// Barcode internal format: '2' + id di-pad 11 digit + 1 check digit.
// Produk lama dibuat waktu ZPos masih pakai Luhn → check digit bukan EAN → scanner
// EAN-13 menolak. Script ini hanya menyentuh barcode yang PERSIS prefix-'2'+id
// (internal buatan ZPos); barcode asli kemasan dibiarkan.
//
// Jalankan:
//   DATABASE_URL="postgres://..." node --experimental-strip-types scripts/fix-internal-barcode.mts
import postgres from 'postgres'

// inline (hindari import .ts yg diblok typecheck): check digit EAN-13
function ean13CheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10) || 0
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: { rejectUnauthorized: false } })

try {
  const rows = await sql<{ id: number; barcode: string }[]>`SELECT id, barcode FROM produk WHERE barcode ~ '^2[0-9]{12}$'`
  let fixed = 0
  const contoh: string[] = []
  for (const r of rows) {
    const base = r.barcode.slice(0, 12)
    const properId = `2${String(Math.abs(r.id)).padStart(11, '0').slice(0, 11)}`
    // Bukan internal buatan ZPos (mis. barcode asli kemasan mulai '2') → lewati.
    if (base !== properId) continue
    const baru = base + String(ean13CheckDigit(base))
    if (baru !== r.barcode) {
      await sql`UPDATE produk SET barcode = ${baru} WHERE id = ${r.id}`
      fixed++
      if (contoh.length < 5) contoh.push(`${r.barcode} -> ${baru} (id ${r.id})`)
    }
  }
  console.log(`Total barcode internal dicek: ${rows.length}`)
  console.log(`Diperbaiki: ${fixed}`)
  for (const c of contoh) console.log('  ' + c)
} catch (e) {
  console.error('GAGAL:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
