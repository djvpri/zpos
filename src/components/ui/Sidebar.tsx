'use client'

import { Receipt, Package, ChartBar, Users, Settings } from 'lucide-react'

type Halaman = 'kasir' | 'produk' | 'laporan' | 'staff' | 'pengaturan'

const NAV_OWNER = [
  { id: 'kasir' as Halaman, label: 'Kasir', icon: Receipt },
  { id: 'produk' as Halaman, label: 'Produk', icon: Package },
  { id: 'laporan' as Halaman, label: 'Laporan', icon: ChartBar },
  { id: 'staff' as Halaman, label: 'Staff', icon: Users },
  { id: 'pengaturan' as Halaman, label: 'Pengaturan', icon: Settings },
] as const

const NAV_KASIR = [
  { id: 'kasir' as Halaman, label: 'Kasir', icon: Receipt },
] as const

interface Props {
  aktif: Halaman
  onNavigasi: (h: Halaman) => void
  role?: string
}

export function Sidebar({ aktif, onNavigasi, role }: Props) {
  const nav = role === 'owner' ? NAV_OWNER : NAV_KASIR

  return (
    <aside className="w-52 bg-[#1e1b4b] flex flex-col py-5 px-3 shrink-0">
      <div className="px-3 mb-7">
        <div className="text-base font-bold text-indigo-200 tracking-wide">Zomet POS</div>
        <div className="text-xs text-indigo-500 mt-0.5">Kasir Digital</div>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map(n => (
          <button
            key={n.id}
            onClick={() => onNavigasi(n.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              aktif === n.id
                ? 'bg-indigo-700 text-indigo-100'
                : 'text-gray-400 hover:bg-indigo-900/50 hover:text-gray-200'
            }`}
          >
            <n.icon size={17} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto px-3">
        <div className="text-xs text-indigo-600">
          {new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}
        </div>
      </div>
    </aside>
  )
}
