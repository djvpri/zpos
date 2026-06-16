'use client'

import { useState } from 'react'
import { useProduk } from '@/hooks/useProduk'
import { ProdukModal } from '@/components/produk/ProdukModal'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react'

export default function ProdukPage() {
  const { produk, tambah, update, hapus } = useProduk()
  const [modal, setModal] = useState<'tambah' | Produk | null>(null)
  const [cari, setCari] = useState('')

  const filtered = produk.filter(p => p.nama.toLowerCase().includes(cari.toLowerCase()))

  const onSimpan = async (p: Partial<Produk>) => {
    if (p.id) await update(p.id, p)
    else await tambah(p as any)
    setModal(null)
  }

  const onHapus = async (id: number) => {
    if (confirm('Hapus produk ini?')) await hapus(id)
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Manajemen Produk</h2>
          <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full">
            {produk.length} produk
          </span>
        </div>
        <button
          onClick={() => setModal('tambah')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors"
        >
          <Plus size={16} /> Tambah Produk
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5 mb-4">
        <Search size={16} className="text-gray-400" />
        <input
          value={cari} onChange={e => setCari(e.target.value)}
          placeholder="Cari produk..."
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      {/* Tabel */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
              <th className="text-left px-4 py-3">Produk</th>
              <th className="text-left px-4 py-3">Kategori</th>
              <th className="text-left px-4 py-3">Harga</th>
              <th className="text-left px-4 py-3">Stok</th>
              <th className="text-left px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.emoji}</span>
                    <span className="text-sm font-medium text-gray-800">{p.nama}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {(p.kategori as any)?.nama || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{fmt(p.harga)}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${
                    p.stok === 0 ? 'text-red-500' :
                    p.stok < 5 ? 'text-red-400' :
                    p.stok < 10 ? 'text-amber-500' : 'text-green-700'
                  }`}>{p.stok}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                      <Edit2 size={12} /> Edit
                    </button>
                    <button onClick={() => onHapus(p.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                      <Trash2 size={12} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-300">
                  <Package size={36} className="mx-auto mb-2 opacity-40" />
                  <span className="text-sm">Tidak ada produk</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ProdukModal
          produk={modal === 'tambah' ? null : modal}
          onSimpan={onSimpan}
          onTutup={() => setModal(null)}
        />
      )}
    </div>
  )
}
