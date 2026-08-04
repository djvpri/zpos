import sql from './db'
import type { TokenPayload } from './auth'

/**
 * Catat satu aksi ke log_aktivitas (untuk audit / anti-kecurangan).
 * Fire-and-forget: kegagalan logging TIDAK pernah menggagalkan aksi utama —
 * dipanggil setelah write utama sukses, tanpa await yang melempar.
 */
export type Aksi =
  | 'login'
  | 'logout'
  | 'transaksi_buat'
  | 'transaksi_batal'
  | 'produk_tambah'
  | 'produk_ubah'
  | 'produk_hapus'
  | 'member_tambah'
  | 'member_ubah'
  | 'member_hapus'
  | 'shift_buka'
  | 'shift_tutup'
  | 'shift_modal'
  | 'bon_bayar'
  | 'staff_tambah'
  | 'staff_ubah'
  | 'staff_hapus'
  | 'staff_pin'
  | 'staff_password'
  | 'kategori_tambah'
  | 'kategori_ubah'
  | 'kategori_hapus'
  | 'data_hapus'
  | 'so_buat'
  | 'so_selesai'
  | 'so_batal'
  | 'so_approve'
  | 'kasir_setup'

const KATEGORI: Record<Aksi, string> = {
  login: 'sesi',
  logout: 'sesi',
  transaksi_buat: 'uang',
  transaksi_batal: 'uang',
  produk_tambah: 'produk',
  produk_ubah: 'produk',
  produk_hapus: 'produk',
  member_tambah: 'member',
  member_ubah: 'member',
  member_hapus: 'member',
  shift_buka: 'uang',
  shift_tutup: 'uang',
  shift_modal: 'uang',
  bon_bayar: 'uang',
  staff_tambah: 'staff',
  staff_ubah: 'staff',
  staff_hapus: 'staff',
  staff_pin: 'staff',
  staff_password: 'staff',
  kategori_tambah: 'produk',
  kategori_ubah: 'produk',
  kategori_hapus: 'produk',
  data_hapus: 'umum',
  so_buat: 'produk',
  so_selesai: 'produk',
  so_batal: 'produk',
  so_approve: 'produk',
  kasir_setup: 'sesi',
}

export async function catatAktivitas(
  toko: Pick<TokenPayload, 'tokoId' | 'userId' | 'userName' | 'role'>,
  aksi: Aksi,
  keterangan?: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO log_aktivitas (toko_id, user_id, nama_user, jabatan, aksi, kategori, keterangan)
      VALUES (${toko.tokoId}, ${toko.userId}, ${toko.userName}, ${toko.role}, ${aksi}, ${KATEGORI[aksi]}, ${keterangan ?? null})
    `
  } catch (e) {
    // Jangan pernah menggagalkan aksi utama gara-gara log gagal menulis.
    console.error('[aktivitas] gagal mencatat', aksi, e)
  }
}
