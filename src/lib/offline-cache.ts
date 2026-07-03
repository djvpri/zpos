// Cache generik untuk data yang cuma dibaca (produk, kategori, pengaturan)
// supaya tetap ada saat app dibuka offline SEJAK AWAL — bukan cuma drop
// koneksi di tengah sesi (yang masih ketolong state React di memori), tapi
// juga saat kasir buka app pertama kali hari itu tanpa sinyal sama sekali,
// di mana state dimulai kosong dan tidak ada apa pun untuk ditampilkan
// kalau fetch pertama gagal.
//
// Tidak ada masa kedaluwarsa di sini (beda dari session hint di useAuth.ts
// yang sengaja dibatasi 7 hari demi keamanan) — untuk katalog produk, data
// basi jauh lebih baik daripada layar kosong, dan begitu online lagi fetch
// berikutnya otomatis menimpa dengan data terbaru.

import { openOfflineDb, STORE_CACHE } from './offline-db'

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite')
    tx.objectStore(STORE_CACHE).put({ key, value, savedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await openOfflineDb()
  const result = await new Promise<{ key: string; value: T; savedAt: number } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly')
    const req = tx.objectStore(STORE_CACHE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result ? result.value : null
}
