export interface Produk {
  id: number
  nama: string
  harga: number
  stok: number
  emoji: string
  deskripsi?: string
  foto_url?: string
  barcode?: string
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
  pajak_persen?: number // hanya untuk tampilan struk, tidak disimpan
  total: number
  bayar: number
  kembali: number
  metode_bayar: 'Tunai' | 'QRIS' | 'Transfer'
  kasir?: string
  dibatalkan?: boolean
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

export interface Staff {
  id: number
  nama: string
  email: string
  role: 'kasir'
  aktif: boolean
  created_at: string
}

export interface Shift {
  id: number
  kasir_nama: string
  modal_awal: number
  buka_at: string
  tutup_at?: string | null
  aktif: boolean
  jumlah_transaksi?: number
  total_penjualan?: number
  total_tunai?: number
  total_qris?: number
  total_transfer?: number
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
