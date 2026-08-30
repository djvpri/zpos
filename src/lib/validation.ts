import { z } from 'zod'
import { desainNotaIds } from '@/lib/desain-nota'

// ===== Auth =====
export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export const registerSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  toko: z.string().min(1, 'Nama toko wajib diisi'),
})

export const forgotSchema = z.object({
  email: z.string().email('Email tidak valid'),
})

export const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

// ===== Produk =====
export const produkSchema = z.object({
  nama: z.string().min(1, 'Nama produk wajib diisi'),
  harga: z.number().positive('Harga harus lebih dari 0'),
  stok: z.number().int().min(0).default(0),
  emoji: z.string().optional(),
  deskripsi: z.string().nullable().optional(),
  foto_url: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  // Barcode internal pendek (6 digit v3) utk label kecil 25mm — di-set server
  // (generateProductBarcode), client tak wajib kirim.
  barcode_internal: z.string().max(64).nullable().optional(),
  kategori_id: z.number().int().positive('Kategori wajib dipilih').nullable(),
  toko_id: z.number().int().positive().optional(),
  expired_at: z.string().nullable().optional(),
  stok_minimum: z.number().int().min(0).default(5),
  client_ref: z.string().nullable().optional(),
  // Dual pricing: nullable, undefined diterima; nilai dibersihkan server (NULL bila kosong).
  harga_grosir: z.number().positive().nullable().optional(),
  min_qty_grosir: z.number().int().min(1).nullable().optional(),
  // Item DIGITAL (jual pulsa/tagihan via Digiflazz). `jenis` default fisik;
  // saat digital, stok dibawa server utk dipaksa 0.
  jenis: z.enum(['fisik', 'digital']).default('fisik'),
  buyer_sku_code: z.string().nullable().optional(),
  modal: z.number().nonnegative().nullable().optional(),
  digital_brand: z.enum(['prabayar', 'pasca']).nullable().optional(),
})

export const produkUpdateSchema = produkSchema.partial().extend({
  id: z.number().int().positive(),
  aktif: z.boolean().optional(),
})

// ===== Kategori =====
export const kategoriSchema = z.object({
  nama: z.string().min(1, 'Nama kategori wajib diisi'),
})

// ===== Transaksi =====
export const detailTransaksiSchema = z.object({
  produk_id: z.number().int().positive(),
  nama_produk: z.string().min(1),
  harga: z.number().positive(),
  qty: z.number().int().positive(),
  subtotal: z.number(),
})

export const transaksiSchema = z.object({
  no_transaksi: z.string().min(1),
  subtotal: z.number(),
  diskon: z.number(),
  pajak: z.number(),
  total: z.number(),
  bayar: z.number(),
  kembali: z.number(),
  metode_bayar: z.enum(['Tunai', 'QRIS', 'Transfer']),
  created_at: z.string().optional(),
})

export const simpanTransaksiSchema = z.object({
  trx: transaksiSchema,
  items: z.array(detailTransaksiSchema),
})

// ===== Shift =====
export const shiftSchema = z.object({
  modal_awal: z.number().int().nonnegative().optional(),
  user_id: z.number().int().positive().optional(),
})

// ===== Pengaturan =====
export const pengaturanSchema = z.object({
  pajak_persen: z.number().min(0).max(100).optional(),
  alamat: z.string().nullable().optional(),
  telepon: z.string().nullable().optional(),
  catatan_struk: z.string().nullable().optional(),
  ukuran_label: z.string().regex(/^\d+x\d+$/).nullable().optional(),
  desain_nota: z.string().refine(v => desainNotaIds.includes(v), { message: 'Desain nota tidak dikenal' }).nullable().optional(),
})

// ===== Admin =====
export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const adminMemberSchema = z.object({
  email: z.string().email(),
})

// ===== Member / Kategori Member =====
export const kategoriMemberSchema = z.object({
  nama: z.string().min(1, 'Nama kategori wajib diisi'),
  diskon_persen: z.number().min(-100).max(100).default(0),
})

export const memberSchema = z.object({
  nama: z.string().min(1, 'Nama member wajib diisi'),
  telepon: z.string().nullable().optional(),
  kategori_member_id: z.number().int().positive().nullable(),
})

// ===== Device login (QR pairing desktop ZPos Windows) =====
export const qrDeviceSchema = z.object({
  device_code: z.string().min(8).max(16),
})
export const qrConfirmSchema = z.object({
  device_code: z.string().min(8).max(16),
  token: z.string().min(1),
})

export const hargaMemberSchema = z.object({
  produk_id: z.number().int().positive(),
  kategori_member_id: z.number().int().positive(),
  harga: z.number().int().positive('Harga harus lebih dari 0'),
  toko_id: z.number().int().positive().optional(),
})

// ===== Stock Opname (SO) =====
export const stockOpnameBuatSchema = z.object({
  nama: z.string().max(200).optional(),
  scope: z.enum(['semua', 'kategori']).default('semua'),
  kategori_id: z.number().int().positive().nullable().optional(),
})
export const stockOpnameScanSchema = z.object({
  barcode: z.string().min(1, 'Barcode wajib diisi').max(64),
  qty: z.number().int().min(1).max(9999).default(1),
})
export const stockOpnameSelesaiSchema = z.object({})
