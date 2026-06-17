'use client'

import { useState, useEffect, useCallback } from 'react'

export function usePengaturan() {
  const [pajakPersen, setPajakPersen] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pengaturan')
      if (res.ok) {
        const data = await res.json()
        setPajakPersen(data.pajak_persen ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const simpan = async (persen: number) => {
    const res = await fetch('/api/pengaturan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pajak_persen: persen }),
    })
    if (res.ok) {
      const data = await res.json()
      setPajakPersen(data.pajak_persen)
      return { error: null }
    }
    const data = await res.json().catch(() => ({}))
    return { error: data.error || 'Gagal menyimpan' }
  }

  return { pajakPersen, loading, simpan }
}
