'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Shift } from '@/types'

export function useShift() {
  const [shift, setShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/shift/active')
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const buka = async (modalAwal: number): Promise<{ error?: string }> => {
    const res = await fetch('/api/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modal_awal: modalAwal }),
    })
    if (res.ok) {
      await load()
      return {}
    }
    const data = await res.json().catch(() => ({}))
    return { error: data.error || 'Gagal membuka shift' }
  }

  const tutup = async (): Promise<{ data?: Shift; error?: string }> => {
    if (!shift) return { error: 'Tidak ada shift aktif' }
    const res = await fetch(`/api/shift/${shift.id}`, { method: 'PATCH' })
    if (res.ok) {
      const data: Shift = await res.json()
      setShift(null)
      return { data }
    }
    const err = await res.json().catch(() => ({}))
    return { error: err.error || 'Gagal menutup shift' }
  }

  return { shift, loading, buka, tutup, reload: load }
}
