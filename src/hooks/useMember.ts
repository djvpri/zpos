'use client'

import { useState, useEffect, useCallback } from 'react'
import { KategoriMember, Member } from '@/types'
import { cacheGet, cacheSet } from '@/lib/offline-cache'

const KAT_CACHE = 'kategori-member'
const MEMBER_CACHE = 'member'

// Kelola kategori member + daftar member (mode manajemen & dropdown kasir).
export function useKategoriMember() {
  const [kategoriMember, setKategoriMember] = useState<KategoriMember[]>([])

  const load = useCallback(() => {
    fetch('/api/kategori-member')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('gagal')))
      .then(data => {
        setKategoriMember(data)
        cacheSet(KAT_CACHE, data).catch(() => {})
      })
      .catch(async () => {
        const cached = await cacheGet<KategoriMember[]>(KAT_CACHE).catch(() => null)
        if (cached) setKategoriMember(cached)
      })
  }, [])

  useEffect(() => { load() }, [load])

  const tambah = useCallback(async (nama: string, diskon_persen: number): Promise<KategoriMember> => {
    const res = await fetch('/api/kategori-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, diskon_persen }),
    })
    if (res.ok) {
      const row = await res.json()
      setKategoriMember(k => [...k, row])
      return row
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Gagal menambah kategori member (${res.status})`)
  }, [])

  const update = useCallback(async (id: number, nama: string, diskon_persen: number) => {
    const res = await fetch(`/api/kategori-member/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, diskon_persen }),
    })
    if (res.ok) {
      const row = await res.json()
      setKategoriMember(k => k.map(x => (x.id === id ? { ...x, ...row } : x)))
      return row
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Gagal perbarui kategori member')
  }, [])

  const hapus = useCallback(async (id: number) => {
    await fetch(`/api/kategori-member/${id}`, { method: 'DELETE' })
    setKategoriMember(k => k.filter(x => x.id !== id))
  }, [])

  return { kategoriMember, tambah, update, hapus, reload: load }
}

// Kelola daftar member (CRUD + lookup utk kasir). `anggota` dipakai UI manajemen;
// `cariMember` dipakai kasir saat mengetik/scan telepon.
export function useMember() {
  const [anggota, setAnggota] = useState<Member[]>([])

  const load = useCallback(() => {
    fetch('/api/member')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('gagal')))
      .then(data => {
        setAnggota(data)
        cacheSet(MEMBER_CACHE, data).catch(() => {})
      })
      .catch(async () => {
        const cached = await cacheGet<Member[]>(MEMBER_CACHE).catch(() => null)
        if (cached) setAnggota(cached)
      })
  }, [])

  useEffect(() => { load() }, [load])

  const tambah = useCallback(async (m: { nama: string; telepon?: string | null; kategori_member_id?: number | null }): Promise<Member> => {
    const res = await fetch('/api/member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    })
    if (res.ok) {
      const row = await res.json()
      setAnggota(a => [...a, row])
      return row
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Gagal menambah member')
  }, [])

  const update = useCallback(async (id: number, m: { nama: string; telepon?: string | null; kategori_member_id?: number | null }) => {
    const res = await fetch(`/api/member/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    })
    if (res.ok) {
      const row = await res.json()
      setAnggota(a => a.map(x => (x.id === id ? { ...x, ...row } : x)))
      return row
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Gagal perbarui member')
  }, [])

  const hapus = useCallback(async (id: number) => {
    await fetch(`/api/member/${id}`, { method: 'DELETE' })
    setAnggota(a => a.filter(x => x.id !== id))
  }, [])

  // Lookup member utk kasir — return daftar cocok telepon/nama (terbatas).
  const cariMember = useCallback(async (q: string): Promise<Member[]> => {
    if (!q.trim()) return []
    const res = await fetch(`/api/member?cari=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    return res.json()
  }, [])

  return { anggota, tambah, update, hapus, reload: load, cariMember }
}

// Harga member per produk utk satu kategori (Map produk_id → harga efektif).
// Dipakai kasir saat member dipilih. Tanpa kategori → kosong.
export function useHargaMember() {
  const getHarga = useCallback(async (kategoriMemberId: number | null): Promise<Record<number, number>> => {
    if (!kategoriMemberId) return {}
    const res = await fetch(`/api/harga-member?kategori_member_id=${kategoriMemberId}`)
    if (!res.ok) return {}
    return res.json()
  }, [])

  const setHarga = useCallback(async (produk_id: number, kategori_member_id: number, harga: number) => {
    const res = await fetch('/api/harga-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produk_id, kategori_member_id, harga }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Gagal set harga member')
    }
  }, [])

  const hapusHarga = useCallback(async (produk_id: number, kategori_member_id: number) => {
    await fetch(`/api/harga-member?produk_id=${produk_id}&kategori_member_id=${kategori_member_id}`, { method: 'DELETE' })
  }, [])

  return { getHarga, setHarga, hapusHarga }
}
