'use client'

import { useState, useEffect, useRef } from 'react'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'
import { Search, ImageFill } from 'react-bootstrap-icons'

const LOAD_PER = 15

interface Props {
  produk: Produk[]
  loading: boolean
  onTambah: (p: Produk) => void
}

export function ProdukGrid({ produk, loading, onTambah }: Props) {
  // Default TANPA foto (list nama-harga-stok) supaya kasir ringan seketika
  // (payload tak 3MB base64). User bisa nyalakan toggle utk lihat thumbnail
  // (foto_thumb, ~1KB) kalau perlu membedakan barang mirip.
  const [tampilFoto, setTampilFoto] = useState(false)
  // Load-more: tampilkan 15 dulu, tombol "Tampilkan lebih banyak" menambah 15.
  const [tampil, setTampil] = useState(LOAD_PER)
  // Reset saat filter (kategori/search) berubah — bagikan dgn array produk baru.
  const prevIds = useRef('')
  useEffect(() => {
    const ids = produk.map(p => p.id).join(',')
    if (ids !== prevIds.current) {
      prevIds.current = ids
      setTampil(LOAD_PER)
    }
  }, [produk])

  const list = produk.slice(0, tampil)

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTampilFoto(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            tampilFoto
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
          }`}
        >
          <ImageFill size={14} />
          Foto
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Memuat produk...</div>
      ) : produk.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-300 gap-2">
          <Search size={36} />
          <span className="text-sm">Produk tidak ditemukan</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {list.map(p => (
            <button
              key={p.id}
              data-testid="product-item"
              onClick={() => onTambah(p)}
              disabled={p.stok <= 0}
              className={`text-left p-3 rounded-xl border transition-all ${
                p.stok <= 0
                  ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                  : 'border-gray-100 bg-white hover:border-indigo-400 hover:shadow-sm cursor-pointer'
              }`}
            >
              {tampilFoto && (p.foto_thumb || p.foto_url) && (
                // eslint-disable-next-line @next/next/no-img-element -- foto thumb/data URI dinamis
                <img src={p.foto_thumb || p.foto_url} alt={p.nama} className="h-12 w-12 mb-2 rounded-lg object-cover" loading="lazy" />
              )}
              {tampilFoto && !p.foto_thumb && !p.foto_url && <div className="text-3xl mb-2">{p.emoji}</div>}
              <div className="text-sm font-medium text-gray-800 leading-tight mb-1">{p.nama}</div>
              <div className="text-xs text-indigo-700 font-semibold">{fmt(p.harga)}</div>
              <div className={`text-xs mt-1 ${
                p.stok <= 0 ? 'text-red-500 font-medium' : p.stok < 5 ? 'text-red-400' : 'text-gray-300'
              }`}>
                {p.stok <= 0 ? 'Stok habis' : `Stok: ${p.stok}`}
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && produk.length > tampil && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => setTampil(t => t + LOAD_PER)}
            className="px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            Tampilkan lebih banyak ({tampil} dari {produk.length})
          </button>
        </div>
      )}
    </div>
  )
}
