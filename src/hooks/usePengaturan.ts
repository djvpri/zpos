'use client'

import { useState, useEffect, useCallback } from 'react'
import { cacheGet, cacheSet } from '@/lib/offline-cache'

export interface Pengaturan {
  pajak_persen: number
  alamat: string
  telepon: string
  catatan_struk: string
}

const CACHE_KEY = 'pengaturan'

export function usePengaturan() {
  const [data, setData] = useState<Pengaturan>({ pajak_persen: 0, alamat: '', telepon: '', catatan_struk: '' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pengaturan')
      if (res.ok) {
        const fresh = await res.json()
        setData(fresh)
        cacheSet(CACHE_KEY, fresh).catch(() => {})
      } else {
        throw new Error('gagal')
      }
    } catch {
      // Offline — pakai pengaturan tersimpan (penting: pajak_persen ikut
      // ter-cache, supaya hitungan total transaksi offline tetap benar,
      // bukan diam-diam jatuh ke default 0%).
      const cached = await cacheGet<Pengaturan>(CACHE_KEY).catch(() => null)
      if (cached) setData(cached)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const simpan = async (payload: Partial<Pengaturan>) => {
    const res = await fetch('/api/pengaturan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ...payload }),
    })
    if (res.ok) {
      const updated = await res.json()
      setData(updated)
      cacheSet(CACHE_KEY, updated).catch(() => {})
      return { error: null }
    }
    const err = await res.json().catch(() => ({}))
    return { error: err.error || 'Gagal menyimpan' }
  }

  return { ...data, pajakPersen: data.pajak_persen, loading, simpan }
}
