// Hitung nama produk unik saat banyak foto produk mirip (sepatu/baju beda ukuran)
// di-upload batch dengan nama Gemini yang sama. Logika murni: cek daftar nama
// yang SUDAH dipakai di toko, lalu tempatkan nama asli, atau append angka unik
// berikutnya ("Sepatu Adidas 2", "Sepatu Adidas 3", ...). Dipakai endpoint
// /api/produk/batch-foto setelah Gemini memberi nama.
export function namaUnikDari(nama: string, dipakai: Set<string>): string {
  if (!dipakai.has(nama)) return nama
  let n = 2
  for (;;) {
    const coba = `${nama} ${n}`
    if (!dipakai.has(coba)) return coba
    n++
  }
}
