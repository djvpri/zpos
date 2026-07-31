// Validasi form produk (murni, tanpa React — bisa diuji langsung Node).
// Dipakai ProdukModal ±: kembalikan daftar field yang kurang supaya UI
// menampilkan pesan jelas (bukan silent return yang membingungkan).

export interface FormInput {
  nama: string
  harga: string | number
  kategori_id: string | number | null | undefined
}

// Field WAJIB yang harus terisi sebelum produk tersimpan. Kategori & harga
// dulu yang dikuatkan — kembalikan apa yang kurang.
export function fieldKurang(f: FormInput): string[] {
  const kurang: string[] = []
  if (!String(f.nama ?? '').trim()) kurang.push('Nama Produk')
  if (Number(f.harga ?? 0) <= 0) kurang.push('Harga')
  if (!f.kategori_id) kurang.push('Kategori')
  return kurang
}
