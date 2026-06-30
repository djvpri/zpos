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

const KATEGORI = ['Makanan', 'Minuman', 'Snack', 'Lainnya']
const PRODUK = [
  ['Nasi Goreng', 25000, '🍳', 'Makanan'], ['Mie Ayam', 18000, '🍜', 'Makanan'],
  ['Ayam Goreng', 22000, '🍗', 'Makanan'], ['Bakso Spesial', 20000, '🍲', 'Makanan'],
  ['Nasi Ayam Geprek', 23000, '🍗', 'Makanan'],
  ['Es Teh Manis', 5000, '🧊', 'Minuman'], ['Jus Jeruk', 12000, '🍊', 'Minuman'],
  ['Kopi Hitam', 8000, '☕', 'Minuman'], ['Es Campur', 15000, '🥤', 'Minuman'],
  ['Keripik Singkong', 8000, '🥔', 'Snack'], ['Cokelat Batang', 12000, '🍫', 'Snack'],
  ['Permen', 3000, '🍬', 'Snack'], ['Tisu Basah', 5000, '🧻', 'Lainnya'],
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
