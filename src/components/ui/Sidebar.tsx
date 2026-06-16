'use client'

import { Receipt, Package, BarChart3 } from 'lucide-react'

const NAV = [
  { id: 'kasir', icon: Receipt, label: 'Kasir' },
  { id: 'produk', icon: Package, label: 'Produk' },
  { id: 'laporan', icon: BarChart3, label: 'Laporan' },
] as const

type Halaman = typeof NAV[number]['id']

interface Props {
  aktif: Halaman
  onNavigasi: (h: Halaman) => void
}

export function Sidebar({ aktif, onNavigasi }: Props) {
  return (
    <aside className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-4 shrink-0">
      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center mb-6">
        <span className="text-white text-sm font-bold">Z</span>
      </div>

      <nav className="flex flex-col items-center gap-1 w-full px-2">
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => onNavigasi(n.id)}
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
