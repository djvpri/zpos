'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TokoInfo {
  tokoId: number
  nama: string
  email: string
  plan: string
}

export function useAuth() {
  const [toko, setToko] = useState<TokoInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setToko(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }, [])

  return { toko, loading, logout }
}
