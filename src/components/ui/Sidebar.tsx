'use client'

import { CashRegister, Package, ChartBar } from 'lucide-react'

const NAV = [
  { id: 'kasir', label: 'Kasir', icon: CashRegister },
  { id: 'produk', label: 'Produk', icon: Package },
  { id: 'laporan', label: 'Laporan', icon: ChartBar },
] as const

type Halaman = typeof NAV[number]['id']

interface Props {
  aktif: Halaman
  onNavigasi: (h: Halaman) => void
}

export function Sidebar({ aktif, onNavigasi }: Props) {
  return (
    <aside className="w-52 bg-[#1e1b4b] flex flex-col py-5 px-3 shrink-0">
      <div className="px-3 mb-7">
        <div className="text-base font-bold text-indigo-200 tracking-wide">Zomet POS</div>
        <div className="text-xs text-indigo-500 mt-0.5">Kasir Digital</div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(n => (
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
