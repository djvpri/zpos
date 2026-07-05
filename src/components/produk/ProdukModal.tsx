'use client'

import { useState } from 'react'
import { Produk } from '@/types'
import { X } from 'lucide-react'

const KATEGORI_ID: Record<string, number> = {
  Makanan: 1, Minuman: 2, Snack: 3, Lainnya: 4
}
const KAT_NAMES = Object.keys(KATEGORI_ID)

interface Props {
  produk?: Produk | null
  onSimpan: (p: Partial<Produk>) => void
  onTutup: () => void
}

export function ProdukModal({ produk, onSimpan, onTutup }: Props) {
  const [form, setForm] = useState({
    nama: produk?.nama || '',
    harga: produk?.harga || '',
    stok: produk?.stok ?? '',
    emoji: produk?.emoji || '📦',
    kategori_id: produk?.kategori_id || 1,
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.nama || !form.harga) return
    onSimpan({
      ...(produk || {}),
      nama: form.nama,
      harga: Number(form.harga),
      stok: Number(form.stok) || 0,
      emoji: form.emoji,
      kategori_id: Number(form.kategori_id),
      aktif: true,
    })
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 mt-1"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base">{produk ? 'Edit Produk' : 'Tambah Produk'}</h3>
          <button onClick={onTutup} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Emoji</label>
            <input className={inputCls} value={form.emoji} onChange={e => set('emoji', e.target.value)} maxLength={2} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Nama Produk</label>
            <input className={inputCls} value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama produk" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Harga (Rp)</label>
              <input className={inputCls} type="number" value={form.harga} onChange={e => set('harga', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Stok</label>
              <input className={inputCls} type="number" value={form.stok} onChange={e => set('stok', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Kategori</label>
            <select className={inputCls} value={form.kategori_id} onChange={e => set('kategori_id', Number(e.target.value))}>
              {KAT_NAMES.map(k => (
                <option key={k} value={KATEGORI_ID[k]}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onTutup} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 transition-colors">
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}
