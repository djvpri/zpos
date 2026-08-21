'use client'

import { useState } from 'react'
import { LaporanHarian } from '@/types'
import { fmt, fmtDate } from '@/lib/utils'
import {
  Printer, Share, Bluetooth, CheckLg, Download,
} from 'react-bootstrap-icons'
import {
  buildEscPosLaporan, printViaBluetooth, isBluetoothSupported,
  selectPrinter, getSavedPrinterName, PrintStatus, StrukLaporan,
} from '@/lib/thermal-print'

interface Props {
  data: LaporanHarian
  namaToko: string
  alamat?: string
  telepon?: string
  catatan_struk?: string
  onTutup: () => void
}

// Modal cetak laporan penjualan harian — strip thermal reuse pola StrukModal
// (Bluetooth via buildEscPosLaporan/printViaBluetooth + print browser dgn CSS
// @media print ala LabelCetak supaya hanya area laporan yang dicetak).
export function LaporanStrukModal({ data, namaToko, alamat, telepon, catatan_struk, onTutup }: Props) {
  const [btStatus, setBtStatus] = useState<PrintStatus>('idle')
  const [btMsg, setBtMsg] = useState('')
  const [savedPrinter, setSavedPrinter] = useState<string | null>(null)

  useState(() => {
    getSavedPrinterName().then(name => setSavedPrinter(name))
  })

  const isRange = data.tanggal.includes(' s/d ')
  // Rentang = label sudah siap pakai ("2026-08-01 s/d 2026-08-07");
  // tanggal tunggal = format lokal.
  const tanggal = isRange ? data.tanggal : fmtDate(data.tanggal)

  const toStruk = (): StrukLaporan => ({
    namaToko,
    alamat,
    telepon,
    tanggal,
    totalPenjualan: data.total_penjualan || 0,
    jumlahTransaksi: data.jumlah_transaksi || 0,
    rataRata: data.rata_rata || 0,
    totalDiskon: data.total_diskon || 0,
    catatan: catatan_struk,
  })

  const teksLaporan = () => {
    const baris: string[] = []
    if (namaToko) baris.push(namaToko)
    if (alamat) baris.push(alamat)
    if (telepon) baris.push(`Tel: ${telepon}`)
    baris.push('--------------------------------')
    baris.push('LAPORAN PENJUALAN HARIAN')
    baris.push(tanggal)
    baris.push('--------------------------------')
    baris.push(`Jumlah Transaksi: ${data.jumlah_transaksi || 0}`)
    baris.push(`Rata-rata: ${fmt(data.rata_rata || 0)}`)
    if ((data.total_diskon || 0) > 0) baris.push(`Total Diskon: -${fmt(data.total_diskon || 0)}`)
    baris.push('--------------------------------')
    baris.push(`TOTAL: ${fmt(data.total_penjualan || 0)}`)
    if (catatan_struk) baris.push(catatan_struk)
    baris.push('Dicetak via Z1 Pos')
    return baris.join('\n')
  }

  const cetakBluetooth = async () => {
    const escPos = buildEscPosLaporan(toStruk())
    await printViaBluetooth(escPos, (status, msg) => {
      setBtStatus(status)
      setBtMsg(msg || '')
    })
  }

  const bagikan = async () => {
    const text = teksLaporan()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Laporan Penjualan Harian', text }) }
      catch { /* dibatalkan user */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const unduhTxt = () => {
    const blob = new Blob([teksLaporan()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-harian-${data.tanggal}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-80 shadow-xl overflow-hidden">
        <style>{`
          @media screen { .x-lap-print-area { display: none; } }
          @media print {
            body > *:not(.x-lap-modal) { visibility: hidden; }
            .x-lap-modal, .x-lap-modal * { visibility: visible !important; }
            .x-lap-modal { position: absolute; left: 0; top: 0; width: 100%; }
            .x-lap-no-print { display: none !important; }
            .x-lap-print-area { display: block !important; }
          }
        `}</style>

        <div className="x-lap-modal">
          {/* Area laporan (yang dicetak) */}
          <div className="x-lap-print-area relative overflow-hidden p-6 font-mono text-sm bg-white">
            <div className="text-center mb-4">
              <div className="text-base font-bold">{namaToko || 'Toko'}</div>
              {alamat && <div className="text-xs text-gray-500 mt-0.5 leading-snug">{alamat}</div>}
              {telepon && <div className="text-xs text-gray-500">Tel: {telepon}</div>}
              <div className="border-b border-dashed border-gray-300 my-3" />
              <div className="text-xs font-semibold">LAPORAN PENJUALAN HARIAN</div>
              <div className="text-xs text-gray-400 mt-0.5">{tanggal}</div>
            </div>

            <div className="space-y-1 mb-3">
              <div className="flex justify-between"><span>Jumlah Transaksi</span><span>{data.jumlah_transaksi || 0}</span></div>
              <div className="flex justify-between"><span>Rata-rata</span><span>{fmt(data.rata_rata || 0)}</span></div>
              {(data.total_diskon || 0) > 0 && (
                <div className="flex justify-between text-green-600"><span>Total Diskon</span><span>-{fmt(data.total_diskon || 0)}</span></div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span><span>{fmt(data.total_penjualan || 0)}</span>
              </div>
            </div>

            <div className="text-center text-xs text-gray-400 space-y-1">
              {catatan_struk && <div>{catatan_struk}</div>}
              <div className="text-gray-300 mt-1">Dicetak via Z1 Pos</div>
            </div>
          </div>
        </div>

        {/* Aksi */}
        <div className="x-lap-no-print px-6 pb-6 pt-2 space-y-2">
          {isBluetoothSupported() && (
            <div className="space-y-1">
              <button
                onClick={cetakBluetooth}
                disabled={btStatus === 'connecting' || btStatus === 'printing'}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
                <Bluetooth size={15} />
                {btStatus === 'connecting' ? 'Menghubungkan...' :
                 btStatus === 'printing' ? 'Mencetak...' :
                 btStatus === 'done' ? <><CheckLg size={14} className="inline mr-1" />Berhasil Dicetak!</> :
                 savedPrinter ? `Cetak ke ${savedPrinter}` : 'Cetak Bluetooth'}
              </button>
              <div className="flex items-center justify-between px-1">
                {savedPrinter
                  ? <span className="text-[10px] text-slate-400"><Bluetooth size={10} className="inline mr-1 -mt-0.5" />Printer: {savedPrinter}</span>
                  : <span className="text-[10px] text-slate-400">Belum ada printer tersimpan</span>
                }
                <button
                  onClick={async () => {
                    const name = await selectPrinter()
                    if (name) setSavedPrinter(name)
                  }}
                  className="text-[10px] text-blue-500 underline">
                  Ganti Printer
                </button>
              </div>
            </div>
          )}
          {btMsg && (
            <p className={`text-xs text-center ${btStatus === 'error' ? 'text-red-500' : btStatus === 'done' ? 'text-green-600' : 'text-gray-500'}`}>
              {btMsg}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              <Printer size={15} /> Cetak
            </button>
            <button onClick={bagikan} className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              <Share size={15} /> Bagikan
            </button>
          </div>
          <button onClick={unduhTxt} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            <Download size={15} /> Unduh .txt
          </button>
          <button onClick={onTutup} className="w-full py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
