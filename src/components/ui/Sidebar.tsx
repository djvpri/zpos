'use client'

import { Receipt, Package, BarChart3, Users, Settings } from 'lucide-react'

const NAV_OWNER = [
  { id: 'kasir', icon: Receipt, label: 'Kasir' },
  { id: 'produk', icon: Package, label: 'Produk' },
  { id: 'laporan', icon: BarChart3, label: 'Laporan' },
  { id: 'staff', icon: Users, label: 'Staff' },
  { id: 'pengaturan', icon: Settings, label: 'Atur' },
] as const

const NAV_KASIR = [
  { id: 'kasir', icon: Receipt, label: 'Kasir' },
] as const

type Halaman = 'kasir' | 'produk' | 'laporan' | 'staff' | 'pengaturan'

interface Props {
  aktif: Halaman
  onNavigasi: (h: Halaman) => void
  role: 'admin' | 'kasir'
}

export function Sidebar({ aktif, onNavigasi, role }: Props) {
  const nav = role === 'admin' ? NAV_OWNER : NAV_KASIR

  return (
    <aside className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-4 shrink-0">
      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center mb-6">
        <span className="text-white text-sm font-bold">Z</span>
      </div>

      <nav className="flex flex-col items-center gap-1 w-full px-2">
        {nav.map(n => (
          <button
            key={n.id}
            onClick={() => onNavigasi(n.id as Halaman)}
            className={`w-full flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
              aktif === n.id
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-500'
            }`}
          >
            <n.icon size={19} />
            <span className="text-[10px] font-medium">{n.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
