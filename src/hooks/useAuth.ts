'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TokoInfo {
  userId: number
  tokoId: number
  nama: string      // nama toko
  userName: string  // nama user yang login
  email: string
  plan: string
  role: 'owner' | 'kasir'
  langganan_sampai?: string | null
  aktif?: boolean
  expired?: boolean
}

export function useAuth() {
  const [toko, setToko] = useState<TokoInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setToko(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMe()
    // Re-fetch saat tab difokuskan kembali (setelah dari Z One)
    window.addEventListener('focus', fetchMe)
    return () => window.removeEventListener('focus', fetchMe)
  }, [fetchMe])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }, [])

  return { toko, loading, logout }
}
