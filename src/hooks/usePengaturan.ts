'use client'

import { useState, useEffect, useCallback } from 'react'
import { cacheGet, cacheSet } from '@/lib/offline-cache'
import { setPendingPengaturan } from '@/lib/offline-settings'

export interface Pengaturan {
  pajak_persen: number
  alamat: string
  telepon: string
  catatan_struk: string
  ukuran_label: string
}

const CACHE_KEY = 'pengaturan'

export function usePengaturan() {
  const [data, setData] = useState<Pengaturan>({ pajak_persen: 0, alamat: '', telepon: '', catatan_struk: '', ukuran_label: '50x30' })
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

  useEffect(() => {
    Promise.resolve().then(load)
  }, [load])

  // Reload setelah siklus sinkron (useAuth.ts) berhasil kirim pengaturan
  // yang sempat tertunda, supaya data lokal sejalan lagi dengan server.
  useEffect(() => {
    const onSynced = () => load()
    window.addEventListener('zpos:pengaturan-synced', onSynced)
    return () => window.removeEventListener('zpos:pengaturan-synced', onSynced)
  }, [load])

  const simpan = async (payload: Partial<Pengaturan>) => {
    const gabungan = { ...data, ...payload }
    try {
      const res = await fetch('/api/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gabungan),
      })
      if (res.ok) {
        const updated = await res.json()
        setData(updated)
        cacheSet(CACHE_KEY, updated).catch(() => {})
        return { error: null }
      }
      const err = await res.json().catch(() => ({}))
      return { error: err.error || 'Gagal menyimpan' }
    } catch {
      // Offline — terapkan langsung ke tampilan lokal (owner lihat
      // hasilnya seketika) & antrikan pengiriman ke server. Single-slot:
      // kalau diubah lagi sebelum sempat sinkron, versi terbaru yang menang.
      setData(gabungan)
      cacheSet(CACHE_KEY, gabungan).catch(() => {})
      await setPendingPengaturan(gabungan)
      return { error: null, queued: true as const }
    }
  }

  return { ...data, pajakPersen: data.pajak_persen, ukuranLabel: data.ukuran_label, loading, simpan }
}
