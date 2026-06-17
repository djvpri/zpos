'use client'

import { Transaksi } from '@/types'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Printer, Share2 } from 'lucide-react'

interface Props {
  transaksi: Transaksi | null
  onTutup: () => void
}

export function StrukModal({ transaksi, onTutup }: Props) {
  if (!transaksi) return null
  const { items, subtotal, diskon, pajak, pajak_persen, total, bayar, kembali, metode_bayar, no_transaksi, kasir } = transaksi
  const waktu = fmtDateTime()

  const teksStruk = () => {
    const baris: string[] = []
    baris.push('ZPOS - Kasir Digital')
    baris.push(waktu)
    baris.push(`No: ${no_transaksi}`)
    if (kasir) baris.push(`Kasir: ${kasir}`)
    baris.push('--------------------------------')
    items?.forEach(it => baris.push(`${it.nama_produk} x${it.qty}\n  ${fmt(it.harga * it.qty)}`))
    baris.push('--------------------------------')
    baris.push(`Subtotal: ${fmt(subtotal)}`)
    if (diskon > 0) baris.push(`Diskon: -${fmt(diskon)}`)
    if (pajak > 0) baris.push(`Pajak${pajak_persen ? ` ${pajak_persen}%` : ''}: ${fmt(pajak)}`)
    baris.push(`TOTAL: ${fmt(total)}`)
    baris.push(`Bayar (${metode_bayar}): ${fmt(bayar)}`)
    baris.push(`Kembali: ${fmt(kembali)}`)
    baris.push('Terima kasih sudah berbelanja!')
    return baris.join('\n')
  }

  const cetak = () => window.print()

  const bagikan = async () => {
    const text = teksStruk()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Struk ${no_transaksi}`, text })
      } catch {
        /* dibatalkan user */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-80 shadow-xl overflow-hidden">
        {/* Area struk (yang dicetak) */}
        <div className="struk-area p-6 font-mono text-sm bg-white">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="text-lg font-bold tracking-widest">ZPOS</div>
            <div className="text-xs text-gray-400">Kasir Digital</div>
            <div className="border-b border-dashed border-gray-300 my-3" />
            <div className="text-xs text-gray-400">{waktu}</div>
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

          <div className="text-center text-xs text-gray-400">
            ★ Terima kasih sudah berbelanja ★
          </div>
        </div>

        {/* Aksi (tidak ikut tercetak) */}
        <div className="no-print px-6 pb-6 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={cetak}
              className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Printer size={15} /> Cetak
            </button>
            <button
              onClick={bagikan}
              className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Share2 size={15} /> Bagikan
            </button>
          </div>
          <button
            onClick={onTutup}
            className="w-full py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
