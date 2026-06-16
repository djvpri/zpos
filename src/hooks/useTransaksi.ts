'use client'

import { useState, useCallback } from 'react'
import { Transaksi, DetailTransaksi } from '@/types'

export function useTransaksi() {
  const [loading, setLoading] = useState(false)
  const [riwayat, setRiwayat] = useState<Transaksi[]>([])

  const simpan = async (trx: Transaksi, items: DetailTransaksi[]) => {
    setLoading(true)
    try {
      const res = await fetch('/api/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trx, items }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan transaksi')
      const data = await res.json()
      return { data, error: null }
    } catch (e: any) {
      return { data: null, error: e.message }
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
