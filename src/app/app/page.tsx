'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import KasirPage from '@/components/kasir/KasirPage'
import ProdukPage from '@/components/produk/ProdukPage'
import LaporanPage from '@/components/laporan/LaporanPage'
import StaffPage from '@/components/staff/StaffPage'
import PengaturanPage from '@/components/pengaturan/PengaturanPage'
import { Receipt, Package, BarChart3, Users, Settings, Lock, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fmtDate } from '@/lib/utils'

type Halaman = 'kasir' | 'produk' | 'laporan' | 'staff' | 'pengaturan'

const NAV_OWNER = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
  { id: 'produk' as Halaman, icon: Package, label: 'Produk' },
  { id: 'laporan' as Halaman, icon: BarChart3, label: 'Laporan' },
  { id: 'staff' as Halaman, icon: Users, label: 'Staff' },
  { id: 'pengaturan' as Halaman, icon: Settings, label: 'Atur' },
]

const NAV_KASIR = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
]

export default function AppPage() {
  const { toko, loading, logout } = useAuth()
  const [halaman, setHalaman] = useState<Halaman>('kasir')

  // Redirect kasir yang coba akses halaman owner
  useEffect(() => {
    if (!loading && toko?.role === 'kasir' && halaman !== 'kasir') {
      setHalaman('kasir')
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
          <Lock size={28} className="text-red-500" />
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
          <LogOut size={15} /> Keluar
        </button>
      </div>
    )
  }

  const isOwner = toko?.role === 'owner'
  const nav = isOwner ? NAV_OWNER : NAV_KASIR

  return (
    <div className="flex h-screen overflow-hidden">
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
  )
}
