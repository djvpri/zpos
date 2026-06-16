'use client'

import { LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const LABEL: Record<string, string> = {
  kasir: 'Kasir',
  produk: 'Manajemen Produk',
  laporan: 'Laporan Penjualan',
  staff: 'Kelola Staff',
}

interface Props {
  halaman: string
}

export function Topbar({ halaman }: Props) {
  const { toko, logout } = useAuth()

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0">
      <span className="font-semibold text-gray-800">{LABEL[halaman] || halaman}</span>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-gray-700 leading-tight">{toko?.nama || '...'}</div>
          <div className="text-xs text-gray-400 capitalize">
            {toko?.userName && toko.role === 'kasir' ? `${toko.userName} · Kasir` : toko?.plan || ''}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
          {toko?.userName?.[0]?.toUpperCase() || toko?.nama?.[0]?.toUpperCase() || 'Z'}
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Keluar"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
