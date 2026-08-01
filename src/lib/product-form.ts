// Validasi form produk (murni, tanpa React — bisa diuji langsung Node).
// Dipakai ProdukModal ±: kembalikan daftar field yang kurang supaya UI
// menampilkan pesan jelas (bukan silent return yang membingungkan).

export interface FormInput {
  nama: string
  harga: string | number
  kategori_id: string | number | null | undefined
}

// Field WAJIB yang harus terisi sebelum produk tersimpan (mode cepat).
// Hanya NAMA yang wajib — harga default 1 & kategori opsional (bisa diisi/update
// belakangan via Excel). Tanpa validasi harga/kategori, input produk cepat tetap mulus.
export function fieldKurang(f: FormInput): string[] {
  const kurang: string[] = []
  if (!String(f.nama ?? '').trim()) kurang.push('Nama Produk')
  return kurang
}
