'use client'

import { useState } from 'react'
import { Plus, Trash2, ShoppingCart } from 'lucide-react'
import { ItemKeranjang } from '@/types'

interface ItemLain {
  id: string
  nama: string
  harga: number
  qty: number
}

interface Props {
  onTambahKeKeranjang: (items: ItemLain[]) => void
}

const PRESET = [
  { nama: 'Jasa Servis', harga: 0 },
  { nama: 'Fotokopi', harga: 500 },
  { nama: 'Print Hitam', harga: 1000 },
  { nama: 'Print Warna', harga: 2500 },
  { nama: 'Laminating', harga: 5000 },
  { nama: 'Jilid', harga: 5000 },
]

export default function PenjualanLain({ onTambahKeKeranjang }: Props) {
  const [items, setItems] = useState<ItemLain[]>([])
  const [nama, setNama] = useState('')
  const [harga, setHarga] = useState('')
  const [qty, setQty] = useState('1')

  function tambah(n: string, h: number, q: number = 1) {
    if (!n.trim() || h < 0 || q < 1) return
    const id = `lain-${Date.now()}-${Math.random()}`
    setItems(prev => [...prev, { id, nama: n.trim(), harga: h, qty: q }])
    setNama(''); setHarga(''); setQty('1')
  }

  function hapus(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function ubahQty(id: string, delta: number) {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i
    ))
  }

  function ubahHarga(id: string, val: string) {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, harga: Number(val) || 0 } : i
    ))
  }

  const total = items.reduce((s, i) => s + i.harga * i.qty, 0)

  function masukKanKeranjang() {
    if (items.length === 0) return
    onTambahKeKeranjang(items)
    setItems([])
  }

  const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-800">Penjualan Lainnya</h2>

      {/* Preset cepat */}
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Preset Cepat</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET.map((p) => (
            <button key={p.nama} onClick={() => tambah(p.nama, p.harga)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition">
              {p.nama} {p.harga > 0 ? `(${fmt(p.harga)})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Form tambah manual */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Tambah Manual</p>
        <div className="flex flex-col gap-2">
          <input value={nama} onChange={e => setNama(e.target.value)}
            placeholder="Nama item / jasa..."
            onKeyDown={e => e.key === 'Enter' && tambah(nama, Number(harga), Number(qty) || 1)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" />
          <div className="flex gap-2">
            <input type="number" value={harga} onChange={e => setHarga(e.target.value)}
              placeholder="Harga (Rp)" inputMode="numeric"
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" />
            <input type="number" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="Qty" inputMode="numeric" min="1"
              className="w-16 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" />
            <button onClick={() => tambah(nama, Number(harga), Number(qty) || 1)}
              disabled={!nama.trim()}
              className="rounded-lg bg-gray-900 px-3 py-2 text-white hover:bg-gray-700 disabled:opacity-40 transition">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Daftar item */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Belum ada item — tambahkan di atas atau pilih preset
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate">{item.nama}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input type="number" value={item.harga}
                      onChange={e => ubahHarga(item.id, e.target.value)}
                      className="w-28 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700 outline-none"
                      inputMode="numeric" />
                    <span className="text-[10px] text-gray-400">× {item.qty} = {fmt(item.harga * item.qty)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => ubahQty(item.id, -1)}
                    className="h-6 w-6 rounded-full border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 flex items-center justify-center">−</button>
                  <span className="w-5 text-center text-xs font-medium">{item.qty}</span>
                  <button onClick={() => ubahQty(item.id, 1)}
                    className="h-6 w-6 rounded-full border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 flex items-center justify-center">+</button>
                  <button onClick={() => hapus(item.id)}
                    className="ml-1 h-6 w-6 rounded-full text-red-400 hover:bg-red-50 flex items-center justify-center">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer total + masukkan keranjang */}
      {items.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-500">{items.length} item</span>
            <span className="font-semibold text-gray-900">{fmt(total)}</span>
          </div>
          <button onClick={masukKanKeranjang}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition">
            <ShoppingCart size={16} /> Masukkan ke Keranjang
          </button>
        </div>
      )}
    </div>
  )
}
