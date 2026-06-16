export interface Produk {
  id: number
  nama: string
  harga: number
  stok: number
  emoji: string
  kategori_id: number | null
  aktif: boolean
  created_at?: string
  updated_at?: string
  // join
  kategori?: { nama: string }
}

export interface Kategori {
  id: number
  nama: string
}

export interface ItemKeranjang extends Produk {
  qty: number
}

export interface Transaksi {
  id?: number
  no_transaksi: string
  subtotal: number
  diskon: number
  pajak: number
  total: number
  bayar: number
  kembali: number
  metode_bayar: 'Tunai' | 'QRIS' | 'Transfer'
  kasir?: string
  created_at?: string
  items?: DetailTransaksi[]
}

export interface DetailTransaksi {
  id?: number
  transaksi_id?: number
  produk_id: number | null
  nama_produk: string
  harga: number
  qty: number
  subtotal: number
}

export interface LaporanHarian {
  tanggal: string
  jumlah_transaksi: number
  total_penjualan: number
  rata_rata: number
  total_diskon: number
}

export interface ProdukTerlaris {
  id: number
  nama: string
  emoji: string
  total_qty: number
  total_penjualan: number
}
