import sql from './db'

// Data demo SENGAJA bertema warung/kafe/toko kelontong — sesuai
// positioning ZPOS di landing page ("Cocok untuk warung, kafe, toko
// kelontong, dan UMKM lainnya"), supaya pengunjung yang coba demo lihat
// sesuatu yang relevan dengan usahanya, bukan data generik.

const KATEGORI_DEMO = ['Makanan', 'Minuman', 'Snack', 'Kebutuhan Harian']

interface ProdukDemo { nama: string; harga: number; stok: number; emoji: string; kategori: string }

const PRODUK_DEMO: ProdukDemo[] = [
  { nama: 'Nasi Goreng', harga: 15000, stok: 40, emoji: '🍛', kategori: 'Makanan' },
  { nama: 'Mie Goreng', harga: 13000, stok: 35, emoji: '🍜', kategori: 'Makanan' },
  { nama: 'Ayam Geprek', harga: 18000, stok: 25, emoji: '🍗', kategori: 'Makanan' },
  { nama: 'Roti Bakar', harga: 10000, stok: 20, emoji: '🍞', kategori: 'Makanan' },
  { nama: 'Es Teh Manis', harga: 5000, stok: 80, emoji: '🧊', kategori: 'Minuman' },
  { nama: 'Kopi Hitam', harga: 8000, stok: 60, emoji: '☕', kategori: 'Minuman' },
  { nama: 'Es Jeruk', harga: 7000, stok: 50, emoji: '🍊', kategori: 'Minuman' },
  { nama: 'Air Mineral 600ml', harga: 4000, stok: 100, emoji: '💧', kategori: 'Minuman' },
  { nama: 'Keripik Singkong', harga: 8000, stok: 30, emoji: '🥔', kategori: 'Snack' },
  { nama: 'Kacang Atom', harga: 7000, stok: 30, emoji: '🥜', kategori: 'Snack' },
  { nama: 'Biskuit Kaleng', harga: 25000, stok: 15, emoji: '🍪', kategori: 'Snack' },
  { nama: 'Beras 5kg', harga: 65000, stok: 20, emoji: '🌾', kategori: 'Kebutuhan Harian' },
  { nama: 'Minyak Goreng 1L', harga: 18000, stok: 25, emoji: '🛢️', kategori: 'Kebutuhan Harian' },
  { nama: 'Gula Pasir 1kg', harga: 14000, stok: 30, emoji: '🧂', kategori: 'Kebutuhan Harian' },
  { nama: 'Telur 1kg', harga: 28000, stok: 20, emoji: '🥚', kategori: 'Kebutuhan Harian' },
]

const HARI_RIWAYAT = 14
const METODE_BAYAR = ['Tunai', 'QRIS']

function acak(min: number, maks: number): number {
  return Math.floor(Math.random() * (maks - min + 1)) + min
}

function pilihAcak<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Seed lengkap untuk satu toko: kategori -> produk -> riwayat transaksi
// (created_at RELATIF ke waktu seed dijalankan, bukan tanggal beku —
// supaya demo yang dibuka bulan apa pun tetap terlihat "baru saja
// terjadi", bukan basi).
export async function seedDataDemo(tokoId: number): Promise<void> {
  const idKategori: Record<string, number> = {}
  for (const nama of KATEGORI_DEMO) {
    const [k] = await sql`INSERT INTO kategori (nama, toko_id) VALUES (${nama}, ${tokoId}) RETURNING id`
    idKategori[nama] = k.id
  }

  const idProduk: { id: number; harga: number; nama: string }[] = []
  for (const p of PRODUK_DEMO) {
    const [row] = await sql`
      INSERT INTO produk (nama, harga, stok, emoji, kategori_id, toko_id)
      VALUES (${p.nama}, ${p.harga}, ${p.stok}, ${p.emoji}, ${idKategori[p.kategori]}, ${tokoId})
      RETURNING id, harga, nama
    `
    idProduk.push({ id: row.id as number, harga: row.harga as number, nama: row.nama as string })
  }

  // Riwayat transaksi HARI_RIWAYAT hari terakhir, beberapa transaksi per
  // hari dengan jam operasional wajar (08:00-21:00) — dihitung relatif
  // dari SEKARANG, jadi tanggalnya selalu "belum lama" kapan pun demo
  // ini dibuat.
  const sekarang = new Date()
  let urutan = 0
  for (let h = HARI_RIWAYAT - 1; h >= 0; h--) {
    const jumlahTrx = acak(4, 12)
    for (let t = 0; t < jumlahTrx; t++) {
      const waktu = new Date(sekarang)
      waktu.setDate(waktu.getDate() - h)
      // Untuk hari ini (h=0), jam acak tidak boleh melebihi jam sekarang —
      // tidak logis demo menunjukkan transaksi yang "belum terjadi" pada
      // hari yang sama. Kalau sekarang masih pagi (<jam 8), lewati saja
      // transaksi hari ini (belum ada jam operasional yang lewat).
      const jamMaks = h === 0 ? Math.min(20, sekarang.getHours()) : 20
      if (h === 0 && jamMaks < 8) continue
      waktu.setHours(acak(8, jamMaks), acak(0, 59), acak(0, 59), 0)

      const jumlahItem = acak(1, 4)
      const itemTerpilih = Array.from({ length: jumlahItem }, () => pilihAcak(idProduk))
      const qtyPerItem = itemTerpilih.map(() => acak(1, 3))
      const subtotal = itemTerpilih.reduce((sum, p, i) => sum + p.harga * qtyPerItem[i], 0)
      const total = subtotal
      const metode = pilihAcak(METODE_BAYAR)
      const bayar = metode === 'Tunai' ? Math.ceil(total / 5000) * 5000 : total
      const kembali = bayar - total

      urutan++
      const noTransaksi = `DEMO-${tokoId}-${urutan}`

      const [trx] = await sql`
        INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id, created_at)
        VALUES (${noTransaksi}, ${subtotal}, 0, 0, ${total}, ${bayar}, ${kembali}, ${metode}, 'Kasir Demo', ${tokoId}, ${waktu})
        RETURNING id
      `

      for (let i = 0; i < itemTerpilih.length; i++) {
        const p = itemTerpilih[i]
        const qty = qtyPerItem[i]
        await sql`
          INSERT INTO detail_transaksi (transaksi_id, produk_id, nama_produk, harga, qty, subtotal, toko_id, created_at)
          VALUES (${trx.id}, ${p.id}, ${p.nama}, ${p.harga}, ${qty}, ${p.harga * qty}, ${tokoId}, ${waktu})
        `
      }
    }
  }
}

// Bersihkan semua data transaksional & katalog milik satu toko (dipakai
// saat reset demo) — TIDAK menghapus toko/user-nya sendiri, cuma isinya.
export async function bersihkanDataToko(tokoId: number): Promise<void> {
  await sql`DELETE FROM detail_transaksi WHERE toko_id = ${tokoId}`
  await sql`DELETE FROM transaksi WHERE toko_id = ${tokoId}`
  await sql`DELETE FROM produk WHERE toko_id = ${tokoId}`
  await sql`DELETE FROM kategori WHERE toko_id = ${tokoId}`
}
