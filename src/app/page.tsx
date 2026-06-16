'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar } from '@/components/ui/Topbar'
import KasirPage from '@/components/kasir/KasirPage'
import ProdukPage from '@/components/produk/ProdukPage'
import LaporanPage from '@/components/laporan/LaporanPage'

type Halaman = 'kasir' | 'produk' | 'laporan'

export default function Home() {
  const [halaman, setHalaman] = useState<Halaman>('kasir')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar aktif={halaman} onNavigasi={setHalaman} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar halaman={halaman} />
        <main className="flex-1 overflow-auto">
          {halaman === 'kasir' && <KasirPage />}
          {halaman === 'produk' && <ProdukPage />}
          {halaman === 'laporan' && <LaporanPage />}
        </main>
      </div>
    </div>
  )
}
