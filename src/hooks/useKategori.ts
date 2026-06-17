'use client'

import { useState, useEffect, useCallback } from 'react'
import { Kategori } from '@/types'

export function useKategori() {
  const [kategori, setKategori] = useState<Kategori[]>([])

  const load = useCallback(() => {
    fetch('/api/kategori')
      .then(r => r.ok ? r.json() : [])
      .then(setKategori)
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const tambah = useCallback(async (nama: string): Promise<boolean> => {
    const res = await fetch('/api/kategori', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama }),
    })
    if (res.ok) {
      const row = await res.json()
      setKategori(k => [...k, row])
      return true
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Gagal menambah kategori (${res.status})`)
  }, [])

  const hapus = useCallback(async (id: number) => {
    await fetch(`/api/kategori/${id}`, { method: 'DELETE' })
    setKategori(k => k.filter(x => x.id !== id))
  }, [])

  return { kategori, tambah, hapus, reload: load }
}
