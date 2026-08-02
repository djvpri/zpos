'use client'

import { useState, useEffect, useCallback } from 'react'
import { cacheGet, cacheSet } from '@/lib/offline-cache'

export interface Bon {
  id: number
  nama: string | null
  produk: Record<number, number>   // produk_id → qty
  total: number
  selesai: boolean
  created_at?: string
}

const CACHE_KEY = 'bon'

export function useBon() {
  const [bon, setBon] = useState<Bon[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((semua = false) => {
    fetch(`/api/bon${semua ? '?semua=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('gagal')))
      .then(data => {
        setBon(data)
        cacheSet(CACHE_KEY, data).catch(() => {})
      })
      .catch(async () => {
        const cached = await cacheGet<Bon[]>(CACHE_KEY).catch(() => null)
        if (cached) setBon(cached)
      })
      .finally(() => setLoading(false))
  }, [])

  // Ambil list aktif saat mount; reload() untuk refresh manual.
  useEffect(() => { load(false) }, [load])

  // Simpan keranjang → bon baru.
  const simpan = useCallback(async (produk: Record<number, number>, nama?: string | null, total?: number): Promise<Bon> => {
    const res = await fetch('/api/bon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produk, nama, total }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Gagal menggantung bon (${res.status})`)
    }
    const row = await res.json()
    setBon(b => [row, ...b])
    return row
  }, [])

  // Hapus bon dari list (refresh list juga utk sinkron).
  const hapus = useCallback(async (id: number) => {
    await fetch(`/api/bon/${id}`, { method: 'DELETE' })
    setBon(b => b.filter(x => x.id !== id))
  }, [])

  // Tandai bon selesai.
  const tandaiSelesai = useCallback(async (id: number) => {
    const res = await fetch(`/api/bon/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selesai: true }),
    })
    if (res.ok) setBon(b => b.filter(x => x.id !== id))  // hilang dari list aktif
    return res.ok
  }, [])

  return { bon, loading, simpan, hapus, tandaiSelesai, reload: load }
}
