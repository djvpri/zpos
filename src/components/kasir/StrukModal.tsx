'use client'

import { Transaksi } from '@/types'
import { fmt, fmtDateTime } from '@/lib/utils'

interface Props {
  transaksi: Transaksi | null
  onTutup: () => void
}

export function StrukModal({ transaksi, onTutup }: Props) {
  if (!transaksi) return null
  const { items, subtotal, diskon, pajak, pajak_persen, total, bayar, kembali, metode_bayar, no_transaksi, kasir } = transaksi

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-80 font-mono text-sm shadow-xl">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-lg font-bold tracking-widest">ZPOS</div>
          <div className="text-xs text-gray-400">Kasir Digital</div>
          <div className="border-b border-dashed border-gray-300 my-3" />
          <div className="text-xs text-gray-400">{fmtDateTime()}</div>
          <div className="text-xs text-gray-400">No: {no_transaksi}</div>
          {kasir && <div className="text-xs text-gray-400">Kasir: {kasir}</div>}
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-gray-300 mb-3">
          {items?.map((it, i) => (
            <div key={i} className="flex justify-between mb-1">
              <span className="flex-1 truncate">{it.nama_produk} x{it.qty}</span>
              <span className="ml-2 whitespace-nowrap">{fmt(it.harga * it.qty)}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {diskon > 0 && (
            <div className="flex justify-between text-green-600"><span>Diskon</span><span>-{fmt(diskon)}</span></div>
          )}
          {pajak > 0 && (
            <div className="flex justify-between"><span>Pajak{pajak_persen ? ` ${pajak_persen}%` : ''}</span><span>{fmt(pajak)}</span></div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span><span>{fmt(total)}</span>
          </div>
        </div>

        <div className="space-y-1 mb-4">
          <div className="flex justify-between">
            <span>Bayar ({metode_bayar})</span>
            <span>{fmt(bayar)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Kembali</span><span>{fmt(kembali)}</span>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mb-4">
          ★ Terima kasih sudah berbelanja ★
        </div>

        <button
          onClick={onTutup}
          className="w-full py-2.5 bg-indigo-700 text-white rounded-lg font-sans text-sm font-medium hover:bg-indigo-800 transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  )
}
