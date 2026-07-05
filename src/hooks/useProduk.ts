'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Produk } from '@/types'
import { cacheGet, cacheSet } from '@/lib/offline-cache'
import { queueBuatProduk, queueUbahProduk, queueHapusProduk, isTempId } from '@/lib/offline-produk-mutasi'

const CACHE_KEY = 'produk'

export function useProduk() {
  const [produk, setProduk] = useState<Produk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await globalThis.fetch('/api/produk')
      if (!res.ok) throw new Error('Gagal memuat produk')
      const data = await res.json()
      setProduk(data)
      setError(null)
      cacheSet(CACHE_KEY, data).catch(() => {})
    } catch (e: any) {
      // Gagal (kemungkinan besar offline) — pakai cache lokal kalau ada,
      // supaya kasir tetap punya katalog untuk dijual, bukan layar kosong.
      const cached = await cacheGet<Produk[]>(CACHE_KEY).catch(() => null)
      if (cached) {
        setProduk(cached)
        setError(null)
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // Dengar sinyal dari siklus sinkron (useAuth.ts) kalau ada mutasi produk
  // yang baru selesai terkirim — reload dari server supaya ID sementara
  // tertukar dengan ID asli & data lain ikut segar.
  useEffect(() => {
    const onSynced = () => fetch()
    window.addEventListener('zpos:produk-synced', onSynced)
    return () => window.removeEventListener('zpos:produk-synced', onSynced)
  }, [fetch])

  const tambah = async (p: Omit<Produk, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const res = await globalThis.fetch('/api/produk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (res.ok) { fetch(); return null }
      return { message: 'Gagal menambah produk' }
    } catch {
      // Offline — antrikan, tampilkan langsung di daftar dengan ID
      // sementara + penanda pending. SENGAJA tidak sellable sampai
      // sinkron (lihat komentar lib/offline-produk-mutasi.ts).
      const tempId = await queueBuatProduk(p)
      setProduk(prev => [...prev, { ...(p as Produk), id: tempId, _pending: true }])
      return null
    }
  }

  const update = async (id: number, p: Partial<Produk>) => {
    if (isTempId(id)) {
      // Belum pernah sampai ke server — cukup ubah di antrian & lokal.
      await queueUbahProduk(id, p)
      setProduk(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))
      return null
    }
    try {
      const res = await globalThis.fetch(`/api/produk/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (res.ok) { fetch(); return null }
      return { message: 'Gagal mengupdate produk' }
    } catch {
      await queueUbahProduk(id, p)
      setProduk(prev => prev.map(x => x.id === id ? { ...x, ...p, _pending: true } : x))
      return null
    }
  }

  const hapus = async (id: number) => {
    if (isTempId(id)) {
      await queueHapusProduk(id)
      setProduk(prev => prev.filter(x => x.id !== id))
      return null
    }
    try {
      const res = await globalThis.fetch(`/api/produk/${id}`, { method: 'DELETE' })
      if (res.ok) { fetch(); return null }
      return { message: 'Gagal menghapus produk' }
    } catch {
      await queueHapusProduk(id)
      setProduk(prev => prev.filter(x => x.id !== id))
      return null
    }
  }

  const kurangiStok = (id: number, qty: number) => {
    setProduk(prev => prev.map(p => p.id === id ? { ...p, stok: p.stok - qty } : p))
  }

  const tambahStok = (id: number, qty: number) => {
    setProduk(prev => prev.map(p => p.id === id ? { ...p, stok: p.stok + qty } : p))
  }

  return { produk, loading, error, fetch, tambah, update, hapus, kurangiStok, tambahStok }
}
