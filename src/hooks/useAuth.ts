'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

export interface TokoInfo {
  userId: number
  tokoId: number
  nama: string
  userName: string
  email: string
  plan: string
  role: 'admin' | 'kasir'
  langganan_sampai?: string | null
  aktif?: boolean
  expired?: boolean
}

interface AuthContextValue {
  toko: TokoInfo | null
  loading: boolean
  offline: boolean
  logout: () => Promise<void>
  refresh: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  toko: null, loading: true, offline: false,
  logout: async () => {}, refresh: () => {}
})

export function useAuth() {
  return useContext(AuthContext)
}

// ===== Sesi offline =====
// Kalau HP kasir tidak ada sinyal, fetch ke /api/auth/me gagal total (bukan
// respons 401 dari server, tapi request-nya sendiri tidak pernah sampai).
// Sebelumnya kegagalan APA PUN diperlakukan sama seperti "belum login",
// jadi kasir yang jaringannya putus di tengah kerja langsung terlempar ke
// layar login. Sekarang: hanya 401 yang benar-benar berarti logout; gagal
// karena jaringan pakai sesi tersimpan lokal (localStorage, BUKAN token asli
// yang httpOnly & tetap aman dari JS), dengan masa tenggang 7 hari — lebih
// pendek dari umur token asli (30 hari) supaya tidak dipercaya tanpa batas.
const HINT_KEY = 'zpos_session_hint'
const HINT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type Hint = { toko: TokoInfo; savedAt: number }

function saveHint(toko: TokoInfo) {
  try { localStorage.setItem(HINT_KEY, JSON.stringify({ toko, savedAt: Date.now() } satisfies Hint)) } catch {}
}

function loadHint(): TokoInfo | null {
  try {
    const raw = localStorage.getItem(HINT_KEY)
    if (!raw) return null
    const hint: Hint = JSON.parse(raw)
    if (Date.now() - hint.savedAt > HINT_MAX_AGE_MS) return null
    return hint.toko
  } catch { return null }
}

function clearHint() {
  try { localStorage.removeItem(HINT_KEY) } catch {}
}

export function useAuthProvider() {
  const [toko, setToko] = useState<TokoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (r.status === 401) {
        // Server terjangkau dan tegas bilang tidak/belum login — logout asli.
        setToko(null)
        setOffline(false)
        clearHint()
        return
      }
      if (!r.ok) throw new Error('Gagal memuat sesi')

      const data = await r.json()
      setToko(data)
      setOffline(false)
      saveHint(data)
    } catch {
      // Request gagal total (offline/DNS/timeout) — bukan sinyal logout.
      // Pakai sesi tersimpan lokal supaya kasir tetap bisa kerja.
      const hint = loadHint()
      setToko(hint)
      setOffline(!!hint)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
    window.addEventListener('focus', fetchMe)
    window.addEventListener('online', fetchMe)
    return () => {
      window.removeEventListener('focus', fetchMe)
      window.removeEventListener('online', fetchMe)
    }
  }, [fetchMe])

  const logout = useCallback(async () => {
    clearHint()
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    window.location.href = '/login'
  }, [])

  return { toko, loading, offline, logout, refresh: fetchMe }
}
