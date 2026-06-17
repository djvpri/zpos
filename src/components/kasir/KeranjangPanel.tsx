'use client'

import { ItemKeranjang } from '@/types'
import { fmt } from '@/lib/utils'
import { ShoppingCart, ShoppingBag, CreditCard } from 'lucide-react'

interface Props {
  items: ItemKeranjang[]
  diskon: number
  bayar: string
  metode: 'Tunai' | 'QRIS' | 'Transfer'
  subtotal: number
  pajak: number
  pajakPersen: number
  total: number
  kembali: number
  kurang: number
  onUbahQty: (id: number, delta: number) => void
  onDiskon: (v: number) => void
  onBayar: (v: string) => void
  onMetode: (m: 'Tunai' | 'QRIS' | 'Transfer') => void
  onBayarSekarang: () => void
}

export function KeranjangPanel({
  items, diskon, bayar, metode, subtotal, pajak, pajakPersen, total, kembali, kurang,
  onUbahQty, onDiskon, onBayar, onMetode, onBayarSekarang
}: Props) {
  const totalItem = items.reduce((s, i) => s + i.qty, 0)
  const bisa = items.length > 0 && (metode !== 'Tunai' || kurang <= 0)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <ShoppingCart size={17} className="text-indigo-500" />
          <span>Pesanan</span>
        </div>
        <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
          {totalItem} item
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3 py-10">
            <ShoppingBag size={44} strokeWidth={1.5} />
            <span className="text-sm">Belum ada item</span>
          </div>
        ) : items.map(it => (
          <div key={it.id} className="flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-xl">{it.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{it.nama}</div>
              <div className="text-xs text-gray-400">{fmt(it.harga)}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUbahQty(it.id, -1)}
                className="w-6 h-6 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-base leading-none"
              >−</button>
              <span className="text-sm font-semibold w-5 text-center">{it.qty}</span>
              <button
                onClick={() => onUbahQty(it.id, 1)}
                className="w-6 h-6 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-base leading-none"
              >+</button>
            </div>
            <div className="text-xs font-semibold text-gray-700 w-16 text-right">
              {fmt(it.harga * it.qty)}
            </div>
          </div>
        ))}
      </div>

      {/* Summary & Bayar */}
      <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-3">
        {/* Diskon */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Diskon (Rp)</label>
          <input
            type="number" value={diskon || ''} onChange={e => onDiskon(Number(e.target.value))}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-2 py-1.5 outline-none focus:border-indigo-400"
            placeholder="0" min={0}
          />
        </div>

        {/* Subtotal / Pajak / Total */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {diskon > 0 && <div className="flex justify-between text-green-500"><span>Diskon</span><span>−{fmt(diskon)}</span></div>}
          {pajakPersen > 0 && <div className="flex justify-between text-gray-400"><span>Pajak {pajakPersen}%</span><span>{fmt(pajak)}</span></div>}
          <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t border-gray-100 mt-1">
            <span>Total</span>
            <span className="text-indigo-600">{fmt(total)}</span>
          </div>
        </div>

        {/* Metode */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['Tunai', 'QRIS', 'Transfer'] as const).map(m => (
            <button
              key={m}
              onClick={() => onMetode(m)}
              className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                metode === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >{m}</button>
          ))}
        </div>

        {/* Input Tunai */}
        {metode === 'Tunai' && (
          <div className="space-y-2">
            <input
              type="number" value={bayar} onChange={e => onBayar(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="Jumlah bayar (Rp)"
            />
            <div className="grid grid-cols-4 gap-1">
              {[20000, 50000, 100000].map(n => (
                <button key={n} onClick={() => onBayar(String(n))}
                  className="text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  {n === 20000 ? '20rb' : n === 50000 ? '50rb' : '100rb'}
                </button>
              ))}
              <button onClick={() => onBayar(String(total))}
                className="text-xs py-1.5 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors font-semibold">
                Pas
              </button>
            </div>
            {Number(bayar) > 0 && (
              <div className={`flex justify-between text-sm font-semibold ${kurang > 0 ? 'text-red-500' : 'text-green-500'}`}>
                <span>{kurang > 0 ? 'Kurang' : 'Kembali'}</span>
                <span>{kurang > 0 ? `−${fmt(kurang)}` : fmt(kembali)}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onBayarSekarang}
          disabled={!bisa}
          className={`w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            bisa
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <CreditCard size={16} />
          {bisa ? `Bayar ${fmt(total)}` : 'Bayar Sekarang'}
        </button>
      </div>
    </div>
  )
}
