// Antrian mutasi produk (buat/ubah/hapus) yang gagal karena offline.
//
// Produk yang DIBUAT offline belum punya ID asli dari server — dipakai ID
// sementara negatif (mis. -1719999999999) supaya bisa langsung tampil di
// daftar produk (owner tahu tersimpan). PENTING — produk dengan ID
// sementara ini SENGAJA tidak bisa dijual sampai berhasil sinkron: kalau
// transaksi yang menjual produk itu JUGA sempat offline, produk_id di
// transaksi itu tidak akan pernah valid di server (server tidak kenal ID
// negatif). Membangun sistem remap ID lintas-antrian butuh kompleksitas
// jauh lebih besar untuk skenario yang jarang terjadi (produk baru dibuat
// LALU langsung dijual, keduanya sebelum sempat online sama sekali) — jadi
// sengaja dibatasi, bukan bug tersembunyi.
//
// Kalau produk ber-ID-sementara itu DIEDIT atau DIHAPUS sebelum sempat
// sinkron, itu diselesaikan LANGSUNG di dalam antrian (ubah payload 'buat'
// yang sudah ada / batalkan seluruhnya) — bukan bikin operasi baru,
// karena belum ada apa pun di server yang perlu disusul.

import { openOfflineDb, STORE_MUTASI_PRODUK } from './offline-db'
import type { Produk } from '@/types'

export type MutasiProduk =
  | { tipe: 'buat'; tempId: number; payload: Partial<Produk> }
  | { tipe: 'ubah'; produkId: number; payload: Partial<Produk> }
  | { tipe: 'hapus'; produkId: number }

export interface QueuedMutasiProduk {
  localId: string
  mutasi: MutasiProduk
  queuedAt: number
}

export function isTempId(id: number): boolean {
  return id < 0
}

export function buatTempId(): number {
  return -(Date.now() + Math.floor(Math.random() * 1000))
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openOfflineDb()
  const result = await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_MUTASI_PRODUK, mode)
    const req = fn(tx.objectStore(STORE_MUTASI_PRODUK))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function getMutasiProduk(): Promise<QueuedMutasiProduk[]> {
  const all = await withStore<QueuedMutasiProduk[]>('readonly', s => s.getAll())
  return all.sort((a, b) => a.queuedAt - b.queuedAt)
}

async function simpanEntry(entry: QueuedMutasiProduk): Promise<void> {
  await withStore('readwrite', s => s.put(entry))
}

async function hapusEntry(localId: string): Promise<void> {
  await withStore('readwrite', s => s.delete(localId))
}

// Antrikan pembuatan produk baru. Kembalikan tempId yang dipakai supaya
// caller bisa langsung tambahkan ke tampilan lokal.
export async function queueBuatProduk(payload: Partial<Produk>): Promise<number> {
  const tempId = buatTempId()
  await simpanEntry({
    localId: `buat-${tempId}`,
    mutasi: { tipe: 'buat', tempId, payload },
    queuedAt: Date.now(),
  })
  return tempId
}

// Antrikan perubahan/hapus. Untuk produk ber-ID-sementara (belum sinkron),
// selesaikan langsung di dalam antrian alih-alih bikin operasi baru.
export async function queueUbahProduk(produkId: number, payload: Partial<Produk>): Promise<void> {
  if (isTempId(produkId)) {
    const semua = await getMutasiProduk()
    const asal = semua.find(x => x.mutasi.tipe === 'buat' && x.mutasi.tempId === produkId)
    if (asal && asal.mutasi.tipe === 'buat') {
      await simpanEntry({ ...asal, mutasi: { ...asal.mutasi, payload: { ...asal.mutasi.payload, ...payload } } })
    }
    return
  }
  await simpanEntry({
    localId: `ubah-${produkId}-${Date.now()}`,
    mutasi: { tipe: 'ubah', produkId, payload },
    queuedAt: Date.now(),
  })
}

export async function queueHapusProduk(produkId: number): Promise<void> {
  if (isTempId(produkId)) {
    const semua = await getMutasiProduk()
    const asal = semua.find(x => x.mutasi.tipe === 'buat' && x.mutasi.tempId === produkId)
    if (asal) await hapusEntry(asal.localId)
    return
  }
  await simpanEntry({
    localId: `hapus-${produkId}-${Date.now()}`,
    mutasi: { tipe: 'hapus', produkId },
    queuedAt: Date.now(),
  })
}

// Kirim semua mutasi tertunda, berurutan (FIFO — penting supaya urutan
// buat->ubah produk yang sama tidak terbalik).
export async function flushMutasiProduk(): Promise<{ synced: number; pending: number }> {
  const antrian = await getMutasiProduk()
  let synced = 0

  for (const entry of antrian) {
    try {
      let res: Response
      if (entry.mutasi.tipe === 'buat') {
        res = await fetch('/api/produk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // client_ref: kunci idempotensi — kalau entry ini sempat sukses
          // di server tapi gagal terhapus dari antrian lokal (retry),
          // server kembalikan baris yang sudah ada alih-alih duplikat.
          body: JSON.stringify({ ...entry.mutasi.payload, client_ref: String(entry.mutasi.tempId) }),
        })
      } else if (entry.mutasi.tipe === 'ubah') {
        res = await fetch(`/api/produk/${entry.mutasi.produkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.mutasi.payload),
        })
      } else {
        res = await fetch(`/api/produk/${entry.mutasi.produkId}`, { method: 'DELETE' })
      }

      // 200/201 = tersimpan. 409 = client_ref sudah ada (percobaan
      // sebelumnya sempat sukses di server tapi gagal terhapus dari
      // antrian lokal) — anggap sukses juga, supaya tidak dobel & tidak
      // nyangkut selamanya di antrian.
      if (res.ok || res.status === 409) {
        await hapusEntry(entry.localId)
        synced++
      } else {
        // Server tegas menolak — data kemungkinan memang tidak valid
        // (mis. field wajib kosong). Tidak akan membaik diulang, buang
        // supaya tidak macet mengunci antrian di sini selamanya.
        await hapusEntry(entry.localId)
      }
    } catch {
      // Gagal jaringan — masih offline, berhenti, coba lagi nanti.
      break
    }
  }

  const sisa = (await getMutasiProduk()).length
  return { synced, pending: sisa }
}
