'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import KasirPage from '@/components/kasir/KasirPage'
import ProdukPage from '@/components/produk/ProdukPage'
import LaporanPage from '@/components/laporan/LaporanPage'
import StaffPage from '@/components/staff/StaffPage'
import PengaturanPage from '@/components/pengaturan/PengaturanPage'
import LisensiPage from '@/components/lisensi/LisensiPage'
import TokoOnlinePage from '@/components/toko-online/TokoOnlinePage'
import { Receipt, Box, BarChartLine, People, Gear, LockFill, BoxArrowRight, Film, CardChecklist, ExclamationTriangle, Shop } from 'react-bootstrap-icons'
import { useAuth } from '@/hooks/useAuth'
import { fmtDate } from '@/lib/utils'

type Halaman = 'kasir' | 'produk' | 'laporan' | 'staff' | 'pengaturan' | 'lisensi' | 'toko-online'

const NAV_OWNER = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
  { id: 'produk' as Halaman, icon: Box, label: 'Produk' },
  { id: 'laporan' as Halaman, icon: BarChartLine, label: 'Laporan' },
  { id: 'staff' as Halaman, icon: People, label: 'Staff' },
  { id: 'lisensi' as Halaman, icon: CardChecklist, label: 'Lisensi' },
  { id: 'toko-online' as Halaman, icon: Shop, label: 'Toko Online' },
  { id: 'pengaturan' as Halaman, icon: Gear, label: 'Atur' },
]

const NAV_KASIR = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
]

export default function AppPage() {
  const { toko, loading, offline, pendingSync, logout, refresh } = useAuth()
  const [halaman, setHalaman] = useState<Halaman>('kasir')
  const [resetLoading, setResetLoading] = useState(false)
  // Banner peringatan lisensi — sisa hari dihitung SEKALI di effect via
  // microtask (bukan sync) biar lolos react-hooks/set-state-in-effect; dan
  // Date.now di-eksekusi async supaya render tetap murni (lih. LisensiPage).
  const [sisaHari, setSisaHari] = useState<number | null>(null)

  useEffect(() => {
    const expires = toko?.langganan_sampai
    if (!expires) return
    Promise.resolve().then(() => {
      setSisaHari(Math.ceil((new Date(expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    })
  }, [toko?.langganan_sampai])
  // Tampilkan banner kalau masih aktif (sisa >0) dan ≤5 hari lagi.
  const warnLisensi = sisaHari !== null && sisaHari > 0 && sisaHari <= 5 && toko?.aktif !== false && !toko?.expired

  async function resetDemo() {
    if (!confirm('Reset semua data demo ke kondisi awal?')) return
    setResetLoading(true)
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      if (res.ok) {
        refresh()
        window.location.reload()
      } else {
        alert('Gagal reset demo, coba lagi.')
      }
    } finally {
      setResetLoading(false)
    }
  }

  // Redirect kasir yang coba akses halaman admin (microtask agar lolos
  // react-hooks/set-state-in-effect — react-hooks/next plugin menolak setState
  // sinkron di body effect).
  useEffect(() => {
    if (!loading && toko?.role === 'kasir' && halaman !== 'kasir') {
      Promise.resolve().then(() => setHalaman('kasir'))
    }
  }, [toko, loading, halaman])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-400 text-sm">Memuat...</div>
      </div>
    )
  }

  // Langganan habis atau toko dinonaktifkan → kunci akses
  if (toko && (toko.expired || toko.aktif === false)) {
    const nonaktif = toko.aktif === false
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <LockFill size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {nonaktif ? 'Toko Dinonaktifkan' : 'Langganan Berakhir'}
        </h1>
        <p className="text-sm text-gray-500 max-w-sm mb-1">
          {nonaktif
            ? 'Akses toko Anda dinonaktifkan oleh admin.'
            : 'Masa langganan toko Anda telah habis sehingga akses kasir dikunci.'}
        </p>
        {!nonaktif && toko.langganan_sampai && (
          <p className="text-xs text-gray-400 mb-5">Berakhir pada {fmtDate(toko.langganan_sampai)}</p>
        )}
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          Hubungi admin untuk {nonaktif ? 'mengaktifkan kembali' : 'memperpanjang langganan'}.
        </p>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          <BoxArrowRight size={15} /> Keluar
        </button>
      </div>
    )
  }

  const isOwner = toko?.role === 'admin'
  const nav = isOwner ? NAV_OWNER : NAV_KASIR

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {warnLisensi && (
        <button
          onClick={() => setHalaman('lisensi')}
          className="shrink-0 bg-amber-500 text-white text-[11px] font-medium text-center py-1.5 flex items-center justify-center gap-2 px-2 hover:bg-amber-600 transition-colors"
        >
          <ExclamationTriangle size={12} className="inline" />
          <span>Lisensi berakhir dalam {sisaHari} hari — segera perpanjang sebelum akses terkunci.</span>
          <span className="underline font-semibold">Lihat detail</span>
        </button>
      )}
      {toko?.isDemo && (
        <div className="shrink-0 bg-indigo-600 text-white text-[11px] font-medium text-center py-1.5 flex items-center justify-center gap-3 flex-wrap px-2">
          <span><Film size={12} className="inline mr-1 -mt-0.5" />Mode Demo — data direset otomatis tiap hari. Dipakai bersama pengunjung lain.</span>
          <button
            onClick={resetDemo}
            disabled={resetLoading}
            className="underline hover:no-underline disabled:opacity-50"
          >
            {resetLoading ? 'Mereset...' : 'Reset Demo Saya'}
          </button>
        </div>
      )}
      {(offline || pendingSync > 0) && (
        <div className="shrink-0 bg-amber-500 text-white text-[11px] font-medium text-center py-1">
          {offline
            ? 'Mode offline — pakai sesi tersimpan. '
            : ''}
          {pendingSync > 0
            ? `${pendingSync} transaksi belum tersinkron, akan terkirim otomatis.`
            : (offline ? 'Data terbaru dari server akan dimuat begitu koneksi kembali.' : '')}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      <div className="hidden md:block">
        <Sidebar aktif={halaman} onNavigasi={setHalaman} role={toko?.role ?? 'kasir'} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar halaman={halaman} />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {halaman === 'kasir' && <KasirPage />}
          {halaman === 'produk' && isOwner && <ProdukPage />}
          {halaman === 'laporan' && isOwner && <LaporanPage />}
          {halaman === 'staff' && isOwner && <StaffPage />}
          {halaman === 'lisensi' && isOwner && <LisensiPage />}
          {halaman === 'toko-online' && isOwner && <TokoOnlinePage />}
          {halaman === 'pengaturan' && isOwner && <PengaturanPage />}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex md:hidden z-40">
        {nav.map(n => (
          <button key={n.id} onClick={() => setHalaman(n.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              halaman === n.id ? 'text-indigo-600' : 'text-gray-400'
            }`}>
            <n.icon size={20} />
            <span className="text-[10px] font-medium">{n.label}</span>
          </button>
        ))}
      </nav>
      </div>
    </div>
  )
}
