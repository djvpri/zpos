// Database IndexedDB bersama untuk semua fitur offline ZPOS: antrian
// transaksi tertunda (offline-queue.ts) dan cache data-baca seperti
// produk/kategori/pengaturan (offline-cache.ts). Satu DB dengan banyak
// object store, dibuka lewat satu fungsi — supaya versi & upgrade-nya
// tidak saling tabrakan kalau tiap fitur buka koneksinya sendiri-sendiri
// (IndexedDB cuma boleh 1 versi aktif per nama DB).

export const DB_NAME = 'zpos-offline'
export const DB_VERSION = 3
export const STORE_ANTRIAN = 'antrian-transaksi'
export const STORE_CACHE = 'cache-baca'
export const STORE_PENGATURAN_PENDING = 'pengaturan-pending'
export const STORE_MUTASI_PRODUK = 'antrian-mutasi-produk'

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_ANTRIAN)) {
        db.createObjectStore(STORE_ANTRIAN, { keyPath: 'localId' })
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_PENGATURAN_PENDING)) {
        db.createObjectStore(STORE_PENGATURAN_PENDING, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_MUTASI_PRODUK)) {
        db.createObjectStore(STORE_MUTASI_PRODUK, { keyPath: 'localId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
