'use client'

import { Produk } from '@/types'
import { fmt } from '@/lib/utils'
import { Search } from 'lucide-react'

interface Props {
  produk: Produk[]
  loading: boolean
  onTambah: (p: Produk) => void
}

export function ProdukGrid({ produk, loading, onTambah }: Props) {
  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          Memuat produk...
        </div>
      ) : produk.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-300 gap-3">
          <Search size={40} strokeWidth={1.5} />
          <span className="text-sm">Produk tidak ditemukan</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {produk.map(p => (
            <button
              key={p.id}
              data-testid="product-item"
              onClick={() => onTambah(p)}
              disabled={p.stok === 0}
              className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all ${
                p.stok === 0
                  ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-100'
                  : 'bg-white border-gray-100 hover:border-indigo-300 hover:shadow-md cursor-pointer active:scale-95'
              }`}
            >
              {p.foto_url ? (
                <img src={p.foto_url} alt={p.nama} className="w-16 h-16 object-cover rounded-xl mb-3" />
              ) : (
                <div className="text-4xl mb-3">{p.emoji}</div>
              )}
              <div className="text-sm font-semibold text-gray-800 leading-tight mb-1">{p.nama}</div>
              <div className="text-xs font-bold text-indigo-600">{fmt(p.harga)}</div>
              {p.stok < 5 && p.stok > 0 && (
                <div className="text-[10px] text-red-400 mt-1">Stok: {p.stok}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
