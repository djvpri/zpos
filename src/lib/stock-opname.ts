import sql from './db'

// Helper inti Stock Opname (SO). Lihat supabase/migration_stock_opname.sql.
//
// Status SO: proses -> selesai -> disetujui  (atau -> dibatalkan)
//   - proses   : kasir masih scan.
//   - selesai  : scan dihentikan, selisih dihitung utk SEMUA produk dalam cakupan
//                (yang tak discan dianggap stok_fisik 0). stok produk BELUM diubah.
//   - disetujui: admin menulis produk.stok = stok_fisik. Perubahan stok baru di sini.
//   - dibatalkan: dibatalkan, tak ada perubahan stok.

export interface ScopeSo {
  mode: 'semua' | 'kategori'
  kategoriId: number | null
}

/** Parse scope string ('semua' | 'kategori:3'). Invalid -> 'semua'. */
export function parseScope(scope: string | null | undefined): ScopeSo {
  if (scope && scope.startsWith('kategori:')) {
    const id = Number(scope.split(':')[1])
    if (Number.isInteger(id) && id > 0) return { mode: 'kategori', kategoriId: id }
  }
  return { mode: 'semua', kategoriId: null }
}

/** Scope string utk disimpan. */
export function scopeToString(s: ScopeSo): string {
  return s.mode === 'kategori' ? `kategori:${s.kategoriId}` : 'semua'
}

/**
 * Buat nomor SO unik per toko & tanggal: SO-YYYYMMDD-XXXX (urutan per hari).
 * Race antar sesi yang dibuka bareng diabaikan (langka, online-only) — `ponytail:`
 * kalau perlu nomor anti-sem dumped, pindah ke sequence DB.
 */
export async function noSoBerikutnya(tokoId: number, tgl: Date = new Date()): Promise<string> {
  const ymd =
    `${tgl.getFullYear()}${String(tgl.getMonth() + 1).padStart(2, '0')}` +
    `${String(tgl.getDate()).padStart(2, '0')}`
  const prefix = `SO-${ymd}`
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM stock_opname
    WHERE toko_id = ${tokoId} AND nomor_so LIKE ${prefix + '%'}
  `
  return `${prefix}-${String((n ?? 0) + 1).padStart(4, '0')}`
}

/**
 * Snapshot produk dalam cakupan sesi (semua produk toko, atau hanya satu kategori),
 * yang AKTIF (aktif = true) — stok hibernasi (aktif=false) di-lewati supaya hasil
 * opname tidak berantakan. Return daftar { produk_id, nama, barcode, kategori_id }.
 */
export async function produkDalamScope(
  tokoId: number,
  s: ScopeSo,
): Promise<{ produk_id: number; nama: string | null; barcode: string | null; kategori_id: number | null }[]> {
  if (s.mode === 'kategori' && s.kategoriId) {
    return sql`
      SELECT id AS produk_id, nama, barcode, kategori_id
      FROM produk
      WHERE toko_id = ${tokoId} AND aktif = true AND kategori_id = ${s.kategoriId}
      ORDER BY nama
    `
  }
  return sql`
    SELECT id AS produk_id, nama, barcode, kategori_id
    FROM produk
    WHERE toko_id = ${tokoId} AND aktif = true
    ORDER BY nama
  `
}

/**
 * Hitung selisih semua produk dalam cakupan utk sesi yang sedang 'proses' dan
 * tulis ke stock_opname_detail.
 *
 * Aturan:
 *  - Produk yang SUDAH di-scan: selisih = stok_fisik - stok_sistem (snapshot).
 *  - Produk dalam cakupan yang BELUM di-scan: dianggap stok_fisik = 0,
 *    selisih = 0 - stok_sistem, dan dibuat baris detail-nya (biar tampil sebagai
 *    hilang/minus di review). Hanya utk produk yang ber-stok (stok != 0) supaya
 *    tidak membanjiri baris "0 - 0 = 0" yang tak relevan.
 *
 * Menulis SEMUA selisih lalu mengembalikan daftar utk review.
 */
export async function hitungSelisih(soId: number, tokoId: number, scope: string): Promise<{ produk_id: number; nama: string | null; stok_fisik: number; stok_sistem: number; selisih: number }[]> {
  const s = parseScope(scope)
  const produk = await produkDalamScope(tokoId, s)

  // selisih utk baris yang sudah di-scan / dibuat dim-like: upsert selisih.
  await sql`
    UPDATE stock_opname_detail d
    SET selisih = d.stok_fisik - d.stok_sistem
    WHERE d.so_id = ${soId}
  `

  // produk dalam cakupan yang belum ada baris detail + punya stok -> buat sbg selisih minus.
  for (const p of produk) {
    const [ada] = await sql`SELECT 1 FROM stock_opname_detail WHERE so_id = ${soId} AND produk_id = ${p.produk_id}`
    if (ada) continue
    // detail dibuat dgn stok_sistem snapshot saat "selesai" — ambil stok terkini.
    const [stok] = await sql`SELECT stok FROM produk WHERE id = ${p.produk_id}`
    const stokSistem = stok?.stok ?? 0
    if (stokSistem === 0) continue // tak relevan (kosong-ke-kosong)
    await sql`
      INSERT INTO stock_opname_detail (so_id, produk_id, nama, barcode, kategori_id, stok_sistem, stok_fisik, selisih)
      VALUES (${soId}, ${p.produk_id}, ${p.nama}, ${p.barcode}, ${p.kategori_id}, ${stokSistem == null ? 0 : stokSistem}, 0, ${-(stokSistem ?? 0)})
    `
  }

  return sql`
    SELECT d.produk_id, COALESCE(d.nama, p.nama) AS nama,
           d.stok_fisik, d.stok_sistem, d.selisih,
           k.nama AS kategori
    FROM stock_opname_detail d
    LEFT JOIN produk p ON p.id = d.produk_id
    LEFT JOIN kategori k ON k.id = d.kategori_id
    WHERE d.so_id = ${soId}
    ORDER BY d.selisih ASC, COALESCE(d.nama, p.nama) ASC
  `
}

/** Cek sesi milik toko ini & masih dalam status tertentu. Return row (postgres Row) atau null. */
export async function ambilSesi(tokoId: number, soId: number) {
  const [row] = await sql`
    SELECT id, nomor_so, status, scope FROM stock_opname WHERE id = ${soId} AND toko_id = ${tokoId}
  `
  return row ?? null
}
