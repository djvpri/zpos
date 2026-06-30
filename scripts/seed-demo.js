// Seed data DEMO untuk ZPOS — mengisi toko (tenant) milik akun demo dengan
// kategori, produk, dan transaksi penjualan realistis tersebar ~2 bulan.
// Trigger kurangi_stok otomatis mengurangi stok produk saat detail transaksi
// dibuat, jadi stok akhir mencerminkan penjualan.
//
// IDEMPOTENT / RESET MANUAL: tiap dijalankan, kategori/produk/transaksi toko ini
// DIHAPUS lalu diisi ulang (baris `toko` TIDAK dihapus). Jalankan ulang untuk
// reset akun demo ke kondisi bersih:
//   node scripts/seed-demo.js
//
// Target toko: env DEMO_EMAIL (email toko), fallback toko bernama "demo",
// fallback toko pertama.

const postgres = require('postgres')
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@zomet.my.id'
const now = new Date()
const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
function daysAgo(n) {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  d.setHours(rint(8, 20), rint(0, 59), rint(0, 59), 0)
  return d
}

const KATEGORI = ['Makanan Ringan', 'Minuman', 'Sembako', 'Kebersihan', 'Rumah Tangga']
const PRODUK = [
  // Makanan Ringan
  ['Chitato Sapi Panggang 68g', 11000, '🥔', 'Makanan Ringan'],
  ['Oreo Original 133g', 9500, '🍪', 'Makanan Ringan'],
  ['Beng-Beng', 2500, '🍫', 'Makanan Ringan'],
  ['Taro Net Seaweed', 8000, '🥨', 'Makanan Ringan'],
  ['SilverQueen 65g', 18000, '🍫', 'Makanan Ringan'],
  // Minuman
  ['Aqua 600ml', 4000, '💧', 'Minuman'],
  ['Teh Botol Sosro 350ml', 5000, '🍵', 'Minuman'],
  ['Coca-Cola 390ml', 7000, '🥤', 'Minuman'],
  ['Pocari Sweat 500ml', 9000, '🧴', 'Minuman'],
  ['Ultra Milk Cokelat 250ml', 6500, '🥛', 'Minuman'],
  ['Kopi Good Day Sachet', 2000, '☕', 'Minuman'],
  // Sembako
  ['Beras Pandan Wangi 5kg', 68000, '🌾', 'Sembako'],
  ['Minyak Goreng 1L', 18000, '🫗', 'Sembako'],
  ['Gula Pasir 1kg', 16000, '🧂', 'Sembako'],
  ['Telur Ayam 1kg', 28000, '🥚', 'Sembako'],
  ['Indomie Goreng', 3500, '🍜', 'Sembako'],
  ['Kecap Manis ABC 220ml', 12000, '🍶', 'Sembako'],
  // Kebersihan
  ['Sabun Lifebuoy 85g', 4500, '🧼', 'Kebersihan'],
  ['Pepsodent 75g', 8000, '🪥', 'Kebersihan'],
  ['Shampoo Sunsilk Sachet', 1000, '🧴', 'Kebersihan'],
  ['Detergen Rinso 770g', 22000, '🧺', 'Kebersihan'],
  ['Sunlight Jeruk Nipis 400ml', 11000, '🧽', 'Kebersihan'],
  // Rumah Tangga
  ['Tisu Paseo 250s', 15000, '🧻', 'Rumah Tangga'],
  ['Baterai ABC AA (isi 2)', 9000, '🔋', 'Rumah Tangga'],
  ['Korek Api Gas', 3000, '🔥', 'Rumah Tangga'],
]
const KASIR = ['Kasir Demo', 'Siti', 'Rian']

async function main() {
  // 1. Toko target
  let rows = await sql`SELECT id, nama FROM toko WHERE lower(email) = ${DEMO_EMAIL.toLowerCase()} LIMIT 1`
  if (rows.length === 0) rows = await sql`SELECT id, nama FROM toko WHERE nama ILIKE '%demo%' ORDER BY id LIMIT 1`
  if (rows.length === 0) rows = await sql`SELECT id, nama FROM toko ORDER BY id LIMIT 1`
  if (rows.length === 0) throw new Error('Tidak ada toko di ZPOS. Daftarkan toko dulu.')
  const tokoId = rows[0].id
  console.log(`Target toko: ${rows[0].nama} [id=${tokoId}]`)

  // 2. RESET data toko ini
  await sql`DELETE FROM detail_transaksi WHERE toko_id = ${tokoId}`
  await sql`DELETE FROM transaksi WHERE toko_id = ${tokoId}`
  await sql`DELETE FROM produk WHERE toko_id = ${tokoId}`
  await sql`DELETE FROM kategori WHERE toko_id = ${tokoId}`
  console.log('Data demo lama (kategori/produk/transaksi) dibersihkan.')

  // 3. Kategori
  const katId = {}
  for (const nama of KATEGORI) {
    const [k] = await sql`INSERT INTO kategori (nama, toko_id) VALUES (${nama}, ${tokoId}) RETURNING id`
    katId[nama] = k.id
  }

  // 4. Produk (stok tinggi supaya tetap positif setelah penjualan)
  const produk = []
  for (const [nama, harga, emoji, kat] of PRODUK) {
    const [p] = await sql`
      INSERT INTO produk (nama, harga, stok, emoji, kategori_id, aktif, toko_id)
      VALUES (${nama}, ${harga}, ${rint(150, 400)}, ${emoji}, ${katId[kat]}, true, ${tokoId})
      RETURNING id, nama, harga`
    produk.push(p)
  }

  // 5. Transaksi tersebar ~60 hari (beberapa per hari), dengan detail
  const base = Date.now()
  let trxCount = 0, itemCount = 0, omzet = 0
  const TRX = 70
  for (let i = 0; i < TRX; i++) {
    const createdAt = daysAgo(rint(0, 60))
    const nItems = rint(1, 4)
    const chosen = []
    const used = new Set()
    for (let j = 0; j < nItems; j++) {
      let p = pick(produk)
      let guard = 0
      while (used.has(p.id) && guard++ < 5) p = pick(produk)
      used.add(p.id)
      chosen.push({ p, qty: rint(1, 3) })
    }
    const subtotal = chosen.reduce((s, c) => s + c.p.harga * c.qty, 0)
    const diskon = Math.random() < 0.2 ? Math.round(subtotal * pick([0.05, 0.1]) / 1000) * 1000 : 0
    const total = subtotal - diskon
    const metode = pick(['Tunai', 'Tunai', 'QRIS', 'Kartu', 'QRIS'])
    const bayar = metode === 'Tunai' ? Math.ceil(total / 5000) * 5000 : total
    const noTrx = `D${tokoId}-${base}-${i}`

    const [trx] = await sql`
      INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id, created_at)
      VALUES (${noTrx}, ${subtotal}, ${diskon}, 0, ${total}, ${bayar}, ${bayar - total}, ${metode}, ${pick(KASIR)}, ${tokoId}, ${createdAt})
      RETURNING id`

    for (const c of chosen) {
      await sql`
        INSERT INTO detail_transaksi (transaksi_id, produk_id, nama_produk, harga, qty, subtotal, toko_id)
        VALUES (${trx.id}, ${c.p.id}, ${c.p.nama}, ${c.p.harga}, ${c.qty}, ${c.p.harga * c.qty}, ${tokoId})`
      itemCount++
    }
    trxCount++
    omzet += total
  }

  console.log('✅ Seed demo ZPOS selesai:')
  console.log(`   kategori=${KATEGORI.length}, produk=${produk.length}, transaksi=${trxCount}, item=${itemCount}, omzet=Rp${omzet.toLocaleString('id-ID')}`)
}

main()
  .then(() => sql.end())
  .catch((e) => { console.error(e); sql.end(); process.exit(1) })
