'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Pengaturan {
  pajak_persen: number
  alamat: string
  telepon: string
  catatan_struk: string
}

export function usePengaturan() {
  const [data, setData] = useState<Pengaturan>({ pajak_persen: 0, alamat: '', telepon: '', catatan_struk: '' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pengaturan')
      if (res.ok) setData(await res.json())
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
      return { error: null }
    }
    const err = await res.json().catch(() => ({}))
    return { error: err.error || 'Gagal menyimpan' }
  }

  return { ...data, pajakPersen: data.pajak_persen, loading, simpan }
}
