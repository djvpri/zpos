'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import KasirPage from '@/components/kasir/KasirPage'
import ProdukPage from '@/components/produk/ProdukPage'
import LaporanPage from '@/components/laporan/LaporanPage'
import StaffPage from '@/components/staff/StaffPage'
import { Receipt, Package, BarChart3, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Halaman = 'kasir' | 'produk' | 'laporan' | 'staff'

const NAV_OWNER = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
  { id: 'produk' as Halaman, icon: Package, label: 'Produk' },
  { id: 'laporan' as Halaman, icon: BarChart3, label: 'Laporan' },
  { id: 'staff' as Halaman, icon: Users, label: 'Staff' },
]

const NAV_KASIR = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
]

export default function AppPage() {
  const { toko, loading } = useAuth()
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
