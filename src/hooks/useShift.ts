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
    } catch {
      // Offline — biarkan shift apa adanya (biasanya masih tersimpan di
      // state dari load sebelumnya). Shift bukan syarat wajib buat
      // jualan (lihat api/transaksi: shiftId null tetap disimpan), jadi
      // tidak perlu penanganan khusus lebih lanjut di sini.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(load)
  }, [load])

  const buka = async (modalAwal: number): Promise<{ error?: string }> => {
    let res: Response
    try {
      res = await fetch('/api/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modal_awal: modalAwal }),
      })
    } catch {
      // Fetch gagal total (offline) — jangan lempar exception tak
      // tertangkap (sebelumnya ini bikin tombol "Mulai Shift" macet
      // permanen di status busy karena setBusy(false) di pemanggil tidak
      // pernah kesampaian). Shift tidak wajib untuk mulai jualan, jadi
      // kasir tetap bisa lanjut tanpa shift sampai koneksi kembali.
      return { error: 'Tidak ada koneksi. Anda tetap bisa mulai jualan tanpa shift — coba buka shift lagi nanti.' }
    }
    if (res.ok) {
      await load()
      return {}
    }
    const data = await res.json().catch(() => ({}))
    return { error: data.error || 'Gagal membuka shift' }
  }

  const tutup = async (): Promise<{ data?: Shift; error?: string }> => {
    if (!shift) return { error: 'Tidak ada shift aktif' }
    let res: Response
    try {
      res = await fetch(`/api/shift/${shift.id}`, { method: 'PATCH' })
    } catch {
      return { error: 'Tidak ada koneksi. Coba tutup shift lagi setelah koneksi kembali.' }
    }
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
