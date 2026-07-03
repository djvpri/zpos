'use client'

import { useState, useCallback } from 'react'
import { Transaksi, DetailTransaksi } from '@/types'
import { queueTransaksi } from '@/lib/offline-queue'

export function useTransaksi() {
  const [loading, setLoading] = useState(false)
  const [riwayat, setRiwayat] = useState<Transaksi[]>([])

  // simpan() coba kirim langsung dulu. Kalau gagal karena SERVER TERJANGKAU
  // tapi menolak (400/403/dst — mis. langganan habis, data tidak valid),
  // itu error asli yang harus diberitahu ke kasir, JANGAN dimasukkan
  // antrian (mengulang data yang sama tidak akan memperbaikinya). Kalau
  // gagal karena request tidak pernah sampai sama sekali (offline), baru
  // masuk antrian lokal — struk tetap bisa dicetak, transaksi otomatis
  // terkirim begitu koneksi kembali.
  const simpan = async (trx: Transaksi, items: DetailTransaksi[]) => {
    setLoading(true)
    try {
      let res: Response
      try {
        res = await fetch('/api/transaksi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trx, items }),
        })
      } catch {
        // Fetch gagal total — tidak ada koneksi. Antrikan.
        await queueTransaksi(trx, items)
        return { data: trx, error: null, queued: true as const }
      }

      if (res.ok || res.status === 409) {
        const data = await res.json()
        return { data, error: null, queued: false as const }
      }

      // Server terjangkau tapi menolak — error asli, jangan diantrikan.
      let msg = 'Gagal menyimpan transaksi'
      try { msg = (await res.json()).error || msg } catch {}
      return { data: null, error: msg, queued: false as const }
    } finally {
      setLoading(false)
    }
  }

  const fetchRiwayat = useCallback(async (limit = 20) => {
    const res = await fetch(`/api/transaksi?limit=${limit}`)
    if (res.ok) setRiwayat(await res.json())
  }, [])

  return { loading, riwayat, simpan, fetchRiwayat }
}
