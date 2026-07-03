// Antrian transaksi offline. Kalau POST /api/transaksi gagal karena tidak
// ada jaringan (bukan karena data ditolak server), transaksi disimpan di
// sini dulu — struk tetap dicetak dari data lokal, kasir tidak perlu
// menunggu. Begitu koneksi kembali, semua yang tertunda otomatis dikirim.
//
// Pakai IndexedDB langsung (bukan localStorage) karena data transaksi bisa
// menumpuk banyak & butuh akses async yang tidak memblokir UI thread.

import type { Transaksi, DetailTransaksi } from '@/types'

const DB_NAME = 'zpos-offline'
const STORE = 'antrian-transaksi'
const DB_VERSION = 1

export interface QueuedTrx {
  localId: string
  trx: Transaksi
  items: DetailTransaksi[]
  queuedAt: number
  attempts: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueTransaksi(trx: Transaksi, items: DetailTransaksi[]): Promise<void> {
  const db = await openDb()
  const entry: QueuedTrx = {
    localId: `${trx.no_transaksi}-${Date.now()}`,
    trx, items,
    queuedAt: Date.now(),
    attempts: 0,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getQueue(): Promise<QueuedTrx[]> {
  const db = await openDb()
  const result = await new Promise<QueuedTrx[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedTrx[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result.sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function getQueueCount(): Promise<number> {
  const db = await openDb()
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return count
}

async function removeFromQueue(localId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(localId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function bumpAttempts(entry: QueuedTrx): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...entry, attempts: entry.attempts + 1 })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// Kirim semua transaksi tertunda ke server, berurutan (bukan paralel — supaya
// kalau memang masih offline, tidak menghabiskan banyak percobaan sekaligus,
// cukup satu gagal lalu berhenti untuk sesi flush ini).
export async function flushQueue(): Promise<{ synced: number; pending: number }> {
  const antrian = await getQueue()
  let synced = 0

  for (const entry of antrian) {
    try {
      const res = await fetch('/api/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trx: entry.trx, items: entry.items }),
      })
      // 200/201 = tersimpan. 409 = no_transaksi sudah ada (percobaan
      // sebelumnya sempat sukses tapi responsnya tidak sampai) — anggap
      // sukses juga, supaya tidak nyangkut selamanya di antrian.
      if (res.ok || res.status === 409) {
        await removeFromQueue(entry.localId)
        synced++
      } else {
        // Server tegas menolak (4xx selain 409) — data kemungkinan memang
        // tidak valid, tidak akan membaik dengan diulang. Buang saja
        // supaya tidak macet mengunci antrian di baris ini selamanya.
        await removeFromQueue(entry.localId)
      }
    } catch {
      // Gagal jaringan — masih offline. Berhenti di sini, coba lagi nanti.
      await bumpAttempts(entry)
      break
    }
  }

  const sisa = await getQueueCount()
  return { synced, pending: sisa }
}
