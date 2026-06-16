'use client'

import { Produk } from '@/types'
import { fmt } from '@/lib/utils'
import { Search } from 'lucide-react'

const KATEGORI = ['Semua', 'Makanan', 'Minuman', 'Snack', 'Lainnya']

interface Props {
  produk: Produk[]
  loading: boolean
  onTambah: (p: Produk) => void
}

export function ProdukGrid({ produk, loading, onTambah }: Props) {
  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Memuat produk...</div>
      ) : produk.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-300 gap-2">
          <Search size={36} />
          <span className="text-sm">Produk tidak ditemukan</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {produk.map(p => (
            <button
              key={p.id}
              onClick={() => onTambah(p)}
              disabled={p.stok === 0}
              className={`text-left p-3 rounded-xl border transition-all ${
                p.stok === 0
                  ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                  : 'border-gray-100 bg-white hover:border-indigo-400 hover:shadow-sm cursor-pointer'
              }`}
            >
              <div className="text-3xl mb-2">{p.emoji}</div>
              <div className="text-sm font-medium text-gray-800 leading-tight mb-1">{p.nama}</div>
              <div className="text-xs text-indigo-700 font-semibold">{fmt(p.harga)}</div>
              <div className={`text-xs mt-1 ${p.stok < 5 ? 'text-red-400' : 'text-gray-300'}`}>
                Stok: {p.stok}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
