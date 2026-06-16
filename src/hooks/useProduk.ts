'use client'

import { useState, useEffect, useCallback } from 'react'
import { Produk } from '@/types'

export function useProduk() {
  const [produk, setProduk] = useState<Produk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await globalThis.fetch('/api/produk')
      if (!res.ok) throw new Error('Gagal memuat produk')
      setProduk(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const tambah = async (p: Omit<Produk, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await globalThis.fetch('/api/produk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    if (res.ok) fetch()
    return res.ok ? null : { message: 'Gagal menambah produk' }
  }

  const update = async (id: number, p: Partial<Produk>) => {
    const res = await globalThis.fetch(`/api/produk/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    if (res.ok) fetch()
    return res.ok ? null : { message: 'Gagal mengupdate produk' }
  }

  const hapus = async (id: number) => {
    const res = await globalThis.fetch(`/api/produk/${id}`, { method: 'DELETE' })
    if (res.ok) fetch()
    return res.ok ? null : { message: 'Gagal menghapus produk' }
  }

  const kurangiStok = (id: number, qty: number) => {
    setProduk(prev => prev.map(p => p.id === id ? { ...p, stok: p.stok - qty } : p))
  }

  const tambahStok = (id: number, qty: number) => {
    setProduk(prev => prev.map(p => p.id === id ? { ...p, stok: p.stok + qty } : p))
  }

  return { produk, loading, error, fetch, tambah, update, hapus, kurangiStok, tambahStok }
}
