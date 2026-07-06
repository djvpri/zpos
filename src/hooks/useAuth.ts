'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { flushQueue, getQueueCount } from '@/lib/offline-queue'
import { flushMutasiProduk, getMutasiProduk } from '@/lib/offline-produk-mutasi'
import { flushPengaturan, getPendingPengaturan } from '@/lib/offline-settings'

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
  isDemo?: boolean
  demoExpiresAt?: string | null
}

interface AuthContextValue {
  toko: TokoInfo | null
  loading: boolean
  offline: boolean
  pendingSync: number
  logout: () => Promise<void>
  refresh: () => void
  syncNow: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  toko: null, loading: true, offline: false, pendingSync: 0,
  logout: async () => {}, refresh: () => {}, syncNow: () => {}
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
  const [pendingSync, setPendingSync] = useState(0)

  const refreshQueueCount = useCallback(async () => {
    try {
      const [transaksi, mutasiProduk, pengaturan] = await Promise.all([
        getQueueCount(),
        getMutasiProduk(),
        getPendingPengaturan(),
      ])
      setPendingSync(transaksi + mutasiProduk.length + (pengaturan ? 1 : 0))
    } catch {}
  }, [])

  // Coba kirim semua yang tertunda: transaksi, mutasi produk (buat/ubah/
  // hapus), dan pengaturan. Dipanggil saat app dibuka, saat browser
  // mendeteksi koneksi kembali ('online'), dan berkala (jaga-jaga kalau
  // event 'online' tidak terpicu tapi sinyal sebenarnya sudah ada, mis.
  // berpindah dari WiFi mati ke data seluler).
  const cobaSinkron = useCallback(async () => {
    try {
      await flushQueue()
    } catch {}
    try {
      const hasilProduk = await flushMutasiProduk()
      if (hasilProduk.synced > 0) window.dispatchEvent(new Event('zpos:produk-synced'))
    } catch {}
    try {
      const sebelumnya = await getPendingPengaturan()
      const berhasil = await flushPengaturan()
      if (berhasil && sebelumnya) window.dispatchEvent(new Event('zpos:pengaturan-synced'))
    } catch {}
    refreshQueueCount()
  }, [refreshQueueCount])

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
    refreshQueueCount()
    cobaSinkron()
    window.addEventListener('focus', fetchMe)
    window.addEventListener('online', fetchMe)
    window.addEventListener('online', cobaSinkron)
    // Jaga-jaga event 'online' tidak terpicu (kadang tidak konsisten di
    // beberapa browser Android) — coba sinkron tiap 2 menit selama app terbuka.
    const interval = setInterval(cobaSinkron, 2 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', fetchMe)
      window.removeEventListener('online', fetchMe)
      window.removeEventListener('online', cobaSinkron)
      clearInterval(interval)
    }
  }, [fetchMe, cobaSinkron, refreshQueueCount])

  const logout = useCallback(async () => {
    clearHint()
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    window.location.href = '/login'
  }, [])

  return { toko, loading, offline, pendingSync, logout, refresh: fetchMe, syncNow: cobaSinkron }
}
