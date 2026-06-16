'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import KasirPage from '@/components/kasir/KasirPage'
import ProdukPage from '@/components/produk/ProdukPage'
import LaporanPage from '@/components/laporan/LaporanPage'
import { Receipt, Package, BarChart3 } from 'lucide-react'

type Halaman = 'kasir' | 'produk' | 'laporan'

const NAV = [
  { id: 'kasir' as Halaman, icon: Receipt, label: 'Kasir' },
  { id: 'produk' as Halaman, icon: Package, label: 'Produk' },
  { id: 'laporan' as Halaman, icon: BarChart3, label: 'Laporan' },
]

export default function Home() {
  const [halaman, setHalaman] = useState<Halaman>('kasir')

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar aktif={halaman} onNavigasi={setHalaman} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar halaman={halaman} />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {halaman === 'kasir' && <KasirPage />}
          {halaman === 'produk' && <ProdukPage />}
          {halaman === 'laporan' && <LaporanPage />}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex md:hidden z-40 safe-area-pb">
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setHalaman(n.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              halaman === n.id ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <n.icon size={20} />
            <span className="text-[10px] font-medium">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
