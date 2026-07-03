// Pengaturan toko itu SINGLETON (satu toko = satu baris pengaturan), beda
// dari transaksi/produk yang tiap operasi berdiri sendiri. Kalau owner ubah
// pengaturan dua kali saat offline, yang perlu dikirim ke server cuma versi
// TERAKHIR — bukan replay dua kali berurutan. Makanya di sini pakai
// single-slot (selalu ditimpa), bukan antrian list seperti transaksi.

import { openOfflineDb, STORE_PENGATURAN_PENDING } from './offline-db'

const SLOT_ID = 'current'

export async function setPendingPengaturan(payload: Record<string, unknown>): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PENGATURAN_PENDING, 'readwrite')
    tx.objectStore(STORE_PENGATURAN_PENDING).put({ id: SLOT_ID, payload, queuedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getPendingPengaturan(): Promise<Record<string, unknown> | null> {
  const db = await openOfflineDb()
  const result = await new Promise<{ id: string; payload: Record<string, unknown> } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_PENGATURAN_PENDING, 'readonly')
    const req = tx.objectStore(STORE_PENGATURAN_PENDING).get(SLOT_ID)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result ? result.payload : null
}

export async function clearPendingPengaturan(): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PENGATURAN_PENDING, 'readwrite')
    tx.objectStore(STORE_PENGATURAN_PENDING).delete(SLOT_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// Coba kirim pengaturan yang tertunda ke server. Dipanggil dari siklus
// sinkron yang sama dengan flushQueue() transaksi (lihat useAuth.ts).
export async function flushPengaturan(): Promise<boolean> {
  const pending = await getPendingPengaturan()
  if (!pending) return true // tidak ada yang tertunda = "sukses" (tidak ada kerjaan)
  try {
    const res = await fetch('/api/pengaturan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pending),
    })
    if (res.ok) {
      await clearPendingPengaturan()
      return true
    }
    // Server menolak (bukan soal jaringan) — buang saja, tidak akan
    // membaik dengan diulang terus, jangan macet menahan antrian lain.
    await clearPendingPengaturan()
    return true
  } catch {
    return false // masih offline, coba lagi nanti
  }
}
