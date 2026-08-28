export interface Produk {
  id: number
  nama: string
  harga: number
  stok: number
  emoji: string
  deskripsi?: string
  foto_url?: string
  foto_thumb?: string
  barcode?: string
  kategori_id: number | null
  aktif: boolean
  // Item DIGITAL (jual pulsa/tagihan via Digiflazz): jenis='digital' → tak
  // dihitung stok & tampil di kasir walau stok 0.
  jenis?: 'fisik' | 'digital'
  buyer_sku_code?: string | null
  modal?: number | null
  digital_brand?: 'prabayar' | 'pasca' | null
  // Dual pricing (grosir & ecer): harga_grosir + min_qty_grosir bernilai NULL/undefined
  // = produk tidak punya harga grosir (ecer saja). Saat qty di keranjang >= min_qty_grosir,
  // otomatis memakai harga_grosir sebagai harga satuan.
  harga_grosir?: number | null
  min_qty_grosir?: number | null
  expired_at?: string | null
  stok_minimum?: number
  created_at?: string
  updated_at?: string
  // join
  kategori?: { nama: string }
  // Klien-saja: true kalau produk ini masih menunggu sinkron ke server
  // (dibuat/diubah saat offline). Tidak pernah dikirim ke API.
  _pending?: boolean
}

export interface Kategori {
  id: number
  nama: string
}

export interface ItemKeranjang extends Produk {
  qty: number
  // Klien-saja: true kalau baris ini memakai harga grosir (dual pricing aktif).
  _grosir?: boolean
  // Klien-saja: harga ecer asli (untuk tampilan coret saat grosir aktif).
  _harga_ecer?: number
  // Klien-saja: true kalau memakai harga khusus member (bukan grosir).
  _member?: boolean
}

// Hasil satu item digital (dari transaksi_digital) utk ditampilkan di struk.
export interface DigitalResult {
  produk_id?: number | null
  buyer_sku_code: string
  customer_no: string
  ref_id: string
  commands: string
  modal?: number | null
  harga_jual: number
  status: string // Sukses | Pending | Gagal | Refund
  sn?: string | null
  message?: string | null
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
  // Nama member aktif saat transaksi (kalau kasir pilih member). String snapshot
  // (bukan member_id/FK) supaya nota lama tetap tampil walau member dihapus.
  member_nama?: string | null
  shift_id?: number | null // diisi kasir Tauri utk tautan shift per kasir
  // Aplikasi asal transaksi: 'kasir' (Z1 Kasir desktop) / 'web' (POS browser).
  // Backward-compat: transaksi lama & tanpa field = 'web'.
  sumber?: string
  bon_tebus_id?: number | null // id bon gantung yg ditebus → stok uda di-hold saat gantung, tebus tak kurangi ulang
  dibatalkan?: boolean
  created_at?: string
  items?: DetailTransaksi[]
  // Hasil item digital (transaksi_digital) yg dikirim server utk struk: sn dsb.
  digital?: DigitalResult[]
}

export interface DetailTransaksi {
  id?: number
  transaksi_id?: number
  produk_id: number | null
  nama_produk: string
  harga: number
  qty: number
  subtotal: number
  // Klien-saja: payload item DIGITAL (jual pulsa/tagihan via Digiflazz).
  // Dipakai /api/transaksi utk request topup. Tidak disimpan ke skema listrik.
  _digital?: {
    buyer_sku_code: string
    customer_no: string
    modal?: number
    brand?: 'prabayar' | 'pasca'
  }
}

export interface Staff {
  id: number
  nama: string
  email: string
  role: 'admin' | 'kasir'
  aktif: boolean
  created_at: string
}

export interface Shift {
  id: number
  nomor_shift?: number | null
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
  total_kas_keluar?: number
}

export interface LaporanHarian {
  tanggal: string
  jumlah_transaksi: number
  total_penjualan: number
  rata_rata: number
  total_diskon: number
  total_tunai?: number
  total_pengeluaran?: number
}

export interface ProdukTerlaris {
  id: number
  nama: string
  emoji: string
  total_qty: number
  total_penjualan: number
}

// ---- Member / Kategori Member (harga khusus per barang) ----

export interface KategoriMember {
  id: number
  nama: string
  diskon_persen: number
  created_at?: string
}

export interface Member {
  id: number
  nama: string
  telepon?: string | null
  kategori_member_id: number | null
  created_at?: string
  // join
  kategori_member?: KategoriMember | null
}

export interface HargaMember {
  id: number
  produk_id: number
  kategori_member_id: number
  harga: number
  // join kategori
  kategori_nama?: string
}
