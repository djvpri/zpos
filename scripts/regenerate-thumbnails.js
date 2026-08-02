// Regenerate thumbnail produk existing ke 128px (sebelumnya 48px, buram
// saat ukuran "besar"). Loop semua produk yg punya foto_url, resize via sharp,
// simpan balik ke foto_thumb. Dijalankan SEKALI setelah deploy perubahan
// thumbnail.ts. Idempoten — aman diulang.
//
//   node scripts/regenerate-thumbnails.js
//
/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres')
const sharp = require('sharp')

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })
const UKURAN = 128

async function buatThumbnail(fotoUrl) {
  try {
    const base64 = String(fotoUrl).replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
    const buf = Buffer.from(base64, 'base64')
    const webp = await sharp(buf)
      .rotate()
      .resize(UKURAN, UKURAN, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    return `data:image/webp;base64,${webp.toString('base64')}`
  } catch {
    return null // foto korup / bukan base64 valid — biarkan kosong
  }
}

async function main() {
  const rows = await sql`SELECT id, foto_url FROM produk WHERE foto_url IS NOT NULL AND foto_url <> ''`
  console.log(`Produk dengan foto: ${rows.length}`)

  let ok = 0, gagal = 0
  for (const r of rows) {
    const thumb = await buatThumbnail(r.foto_url)
    if (thumb) {
      await sql`UPDATE produk SET foto_thumb = ${thumb} WHERE id = ${r.id}`
      ok++
    } else {
      gagal++
    }
  }

  console.log(`✅ Selesai: thumbnail ${ok} produk diperbarui, ${gagal} gagal (foto korup).`)
}

main()
  .then(() => sql.end())
  .catch((e) => { console.error(e); sql.end(); process.exit(1) })
