// Preset produk siap-pakai untuk minimarket/warung — dipakai fitur "Template"
// (Tambah cepat toko baru). Harga/stok adalah default wajar; user bisa ubah
// sesudahnya. Struktur sesuai endpoint /api/produk/import.

export interface TemplateProdukItem {
  nama: string
  harga: number
  stok: number
  kategori: string
}

export interface TemplateKategori {
  id: string
  nama: string
  emoji: string
  deskripsi: string
  produk: TemplateProdukItem[]
}

export const PRODUK_TEMPLATES: TemplateKategori[] = [
  {
    id: 'sembako',
    nama: 'Sembako',
    emoji: '🌾',
    deskripsi: 'Kebutuhan pokok dapur & pangan',
    produk: [
      { nama: 'Beras Premium 5kg', harga: 65000, stok: 20, kategori: 'Sembako' },
      { nama: 'Beras Medium 5kg', harga: 58000, stok: 15, kategori: 'Sembako' },
      { nama: 'Minyak Goreng 1L', harga: 18000, stok: 40, kategori: 'Sembako' },
      { nama: 'Minyak Goreng 2L', harga: 34000, stok: 30, kategori: 'Sembako' },
      { nama: 'Gula Pasir 1kg', harga: 17000, stok: 25, kategori: 'Sembako' },
      { nama: 'Gula Pasir 1/2kg', harga: 9000, stok: 30, kategori: 'Sembako' },
      { nama: 'Telur Ayam 1kg', harga: 28000, stok: 15, kategori: 'Sembako' },
      { nama: 'Tepung Terigu 1kg', harga: 12000, stok: 20, kategori: 'Sembako' },
      { nama: 'Garam 500g', harga: 6000, stok: 30, kategori: 'Sembako' },
      { nama: 'Kecap Manis 275ml', harga: 11000, stok: 20, kategori: 'Sembako' },
      { nama: 'Saus Sambal 135ml', harga: 8000, stok: 20, kategori: 'Sembako' },
      { nama: 'Kopi Instan Sachet (5pcs)', harga: 6000, stok: 50, kategori: 'Sembako' },
      { nama: 'Teh Celup (25pcs)', harga: 8000, stok: 25, kategori: 'Sembako' },
      { nama: 'Air Mineral Galon Isi Ulang', harga: 15000, stok: 10, kategori: 'Sembako' },
    ],
  },
  {
    id: 'minuman',
    nama: 'Minuman',
    emoji: '🧃',
    deskripsi: 'Minuman dingin & kemasan',
    produk: [
      { nama: 'Air Mineral 600ml', harga: 3000, stok: 50, kategori: 'Minuman' },
      { nama: 'Air Mineral 1.5L', harga: 5000, stok: 30, kategori: 'Minuman' },
      { nama: 'Teh Botol Sosro 350ml', harga: 5000, stok: 40, kategori: 'Minuman' },
      { nama: 'Teh Kotak 350ml', harga: 5000, stok: 40, kategori: 'Minuman' },
      { nama: 'Kopi Susu Kemasan 250ml', harga: 7000, stok: 30, kategori: 'Minuman' },
      { nama: 'Kelapa Muda Kemasan', harga: 10000, stok: 20, kategori: 'Minuman' },
      { nama: 'Jus Kemasan 250ml', harga: 7000, stok: 25, kategori: 'Minuman' },
      { nama: 'Susu UHT 250ml', harga: 8000, stok: 20, kategori: 'Minuman' },
      { nama: 'Energi Drink 250ml', harga: 9000, stok: 25, kategori: 'Minuman' },
      { nama: 'Soda Kaleng 330ml', harga: 10000, stok: 30, kategori: 'Minuman' },
      { nama: 'Es Krim Cone', harga: 5000, stok: 0, kategori: 'Minuman' },
      { nama: 'Yogurt 100ml', harga: 6000, stok: 20, kategori: 'Minuman' },
    ],
  },
  {
    id: 'snack',
    nama: 'Snack',
    emoji: '🍿',
    deskripsi: 'Camilan & makanan ringan',
    produk: [
      { nama: 'Keripik Singkong 68g', harga: 8000, stok: 30, kategori: 'Snack' },
      { nama: 'Kerupuk Udang', harga: 5000, stok: 25, kategori: 'Snack' },
      { nama: 'Biskuit Coklat 140g', harga: 9000, stok: 20, kategori: 'Snack' },
      { nama: 'Wafer 145g', harga: 10000, stok: 20, kategori: 'Snack' },
      { nama: 'Kacang Garing 30g', harga: 3000, stok: 40, kategori: 'Snack' },
      { nama: 'Permen (per pack)', harga: 3000, stok: 50, kategori: 'Snack' },
      { nama: 'Cokelat Batang', harga: 12000, stok: 25, kategori: 'Snack' },
      { nama: 'Mi Instan Goreng', harga: 3500, stok: 60, kategori: 'Snack' },
      { nama: 'Mi Instan Kuah', harga: 3500, stok: 60, kategori: 'Snack' },
      { nama: 'Roti Tawar', harga: 15000, stok: 10, kategori: 'Snack' },
      { nama: 'Popcorn Microwave', harga: 12000, stok: 15, kategori: 'Snack' },
    ],
  },
]
