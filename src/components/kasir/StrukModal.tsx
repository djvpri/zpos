'use client'

import { useState } from 'react'
import { Transaksi } from '@/types'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Printer, Share2, Bluetooth } from 'lucide-react'
import { buildEscPos, printViaBluetooth, isBluetoothSupported, PrintStatus, StrukData } from '@/lib/thermal-print'

interface TokoInfo {
  nama: string
  alamat?: string
  telepon?: string
  catatan_struk?: string
}

interface Props {
  transaksi: Transaksi | null
  toko?: TokoInfo
  onTutup: () => void
}

export function StrukModal({ transaksi, toko, onTutup }: Props) {
  if (!transaksi) return null
  const { items, subtotal, diskon, pajak, pajak_persen, total, bayar, kembali, metode_bayar, no_transaksi, kasir } = transaksi
  const waktu = fmtDateTime()
  const [btStatus, setBtStatus] = useState<PrintStatus>('idle')
  const [btMsg, setBtMsg] = useState('')

  const teksStruk = () => {
    const baris: string[] = []
    if (toko?.nama) baris.push(toko.nama)
    if (toko?.alamat) baris.push(toko.alamat)
    if (toko?.telepon) baris.push(`Tel: ${toko.telepon}`)
    baris.push('--------------------------------')
    baris.push(waktu)
    baris.push(`No: ${no_transaksi}`)
    if (kasir) baris.push(`Kasir: ${kasir}`)
    baris.push('--------------------------------')
    items?.forEach(it => {
      baris.push(`${it.nama_produk} x${it.qty}`)
      baris.push(`  ${fmt(it.harga * it.qty)}`)
    })
    baris.push('--------------------------------')
    baris.push(`Subtotal: ${fmt(subtotal)}`)
    if (diskon > 0) baris.push(`Diskon: -${fmt(diskon)}`)
    if (pajak > 0) baris.push(`Pajak${pajak_persen ? ` ${pajak_persen}%` : ''}: ${fmt(pajak)}`)
    baris.push(`TOTAL: ${fmt(total)}`)
    baris.push(`Bayar (${metode_bayar}): ${fmt(bayar)}`)
    baris.push(`Kembali: ${fmt(kembali)}`)
    if (toko?.catatan_struk) baris.push(toko.catatan_struk)
    baris.push('Powered by ZPOS')
    return baris.join('\n')
  }

  const cetak = () => window.print()

  const cetakBluetooth = async () => {
    const data: StrukData = {
      namaToko: toko?.nama || 'Toko',
      alamat: toko?.alamat,
      telepon: toko?.telepon,
      waktu,
      noTransaksi: no_transaksi,
      kasir,
      items: (items || []).map(it => ({
        nama: it.nama_produk,
        qty: it.qty,
        harga: it.harga,
      })),
      subtotal,
      diskon,
      pajak,
      pajakPersen: pajak_persen,
      total,
      bayar,
      kembali,
      metodeBayar: metode_bayar,
      catatan: toko?.catatan_struk,
    }
    const escPos = buildEscPos(data)
    await printViaBluetooth(escPos, (status, msg) => {
      setBtStatus(status)
      setBtMsg(msg || '')
    })
  }

  const bagikan = async () => {
    const text = teksStruk()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: `Struk ${no_transaksi}`, text }) }
      catch { /* dibatalkan user */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-80 shadow-xl overflow-hidden">
        {/* Area struk (yang dicetak) */}
        <div className="struk-area p-6 font-mono text-sm bg-white">

          {/* Header — info toko */}
          <div className="text-center mb-4">
            <div className="text-base font-bold">{toko?.nama || 'Toko'}</div>
            {toko?.alamat && <div className="text-xs text-gray-500 mt-0.5 leading-snug">{toko.alamat}</div>}
            {toko?.telepon && <div className="text-xs text-gray-500">Tel: {toko.telepon}</div>}
            <div className="border-b border-dashed border-gray-300 my-3" />
            <div className="text-xs text-gray-400">{waktu}</div>
            <div className="text-xs text-gray-400">No: {no_transaksi}</div>
            {kasir && <div className="text-xs text-gray-400">Kasir: {kasir}</div>}
          </div>

          {/* Items */}
          <div className="border-b border-dashed border-gray-300 mb-3">
            {items?.map((it, i) => (
              <div key={i} className="mb-1">
                <div className="truncate">{it.nama_produk} x{it.qty}</div>
                <div className="text-right whitespace-nowrap">{fmt(it.harga * it.qty)}</div>
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

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 space-y-1">
            {toko?.catatan_struk && <div>{toko.catatan_struk}</div>}
            <div>★ Terima kasih sudah berbelanja ★</div>
            <div className="text-gray-300 mt-1">Powered by ZPOS</div>
          </div>
        </div>

        {/* Aksi */}
        <div className="no-print px-6 pb-6 pt-2 space-y-2">
          {/* Tombol Bluetooth — tampil kalau browser support Web Bluetooth */}
          {isBluetoothSupported() && (
            <button
              onClick={cetakBluetooth}
              disabled={btStatus === 'connecting' || btStatus === 'printing'}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              <Bluetooth size={15} />
              {btStatus === 'connecting' ? 'Menghubungkan...' :
               btStatus === 'printing' ? 'Mencetak...' :
               btStatus === 'done' ? '✓ Berhasil Dicetak!' :
               '🖨️ Cetak Bluetooth'}
            </button>
          )}
          {/* Pesan status Bluetooth */}
          {btMsg && (
            <p className={`text-xs text-center ${btStatus === 'error' ? 'text-red-500' : btStatus === 'done' ? 'text-green-600' : 'text-gray-500'}`}>
              {btMsg}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={cetak} className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              <Printer size={15} /> Cetak
            </button>
            <button onClick={bagikan} className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              <Share2 size={15} /> Bagikan
            </button>
          </div>
          <button onClick={onTutup} className="w-full py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
