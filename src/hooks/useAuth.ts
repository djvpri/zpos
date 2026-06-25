'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

export interface TokoInfo {
  userId: number
  tokoId: number
  nama: string
  userName: string
  email: string
  plan: string
  role: 'owner' | 'kasir'
  langganan_sampai?: string | null
  aktif?: boolean
  expired?: boolean
}

interface AuthContextValue {
  toko: TokoInfo | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  toko: null, loading: true,
  logout: async () => {}, refresh: () => {}
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthProvider() {
  const [toko, setToko] = useState<TokoInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const data = r.ok ? await r.json() : null
      console.log('[useAuth] fetchMe role:', data?.role)
      setToko(data)
    } catch {
      setToko(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
    window.addEventListener('focus', fetchMe)
    return () => window.removeEventListener('focus', fetchMe)
  }, [fetchMe])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }, [])

  return { toko, loading, logout, refresh: fetchMe }
}
