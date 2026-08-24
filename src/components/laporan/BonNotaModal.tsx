'use client'

import { useState } from 'react'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Printer, Bluetooth, CheckLg } from 'react-bootstrap-icons'
import { buildEscPos, printViaBluetooth, selectPrinter, isBluetoothSupported, getSavedPrinterName } from '@/lib/thermal-print'
import { getDesainNota } from '@/lib/desain-nota'

interface BonItem { produk_id: number; nama: string; harga: number; qty: number; subtotal: number }
export interface BonNota {
  id: number
  nama: string | null
  total: number
  selesai: boolean
  created_at: string
  dibayar_at: string | null
  items: BonItem[]
}

interface TokoInfo { nama: string; alamat?: string; telepon?: string; catatan_struk?: string }

interface Props {
  nota: BonNota
  toko: TokoInfo
  desain?: string
  onTutup: () => void
}

// Nota bon gantung — item + total, tanpa detail bayar/kembali (bon belum lunas).
export function BonNotaModal({ nota, toko, desain, onTutup }: Props) {
  const [btStatus, setBtStatus] = useState<'idle' | 'connecting' | 'printing' | 'done' | 'error'>('idle')
  const [btMsg, setBtMsg] = useState('')
  const [savedPrinter, setSavedPrinter] = useState<string | null>(null)

  useState(() => { getSavedPrinterName().then(setSavedPrinter) })
  const tpl = getDesainNota(desain)

  const waktu = nota.created_at
    ? new Date(nota.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : fmtDateTime()

  const cetak = () => window.print()

  const cetakBluetooth = async () => {
    const data = {
      namaToko: toko.nama || 'Toko',
      alamat: toko.alamat,
      telepon: toko.telepon,
      waktu,
      noTransaksi: `Bon #${nota.id}`,
      kasir: nota.nama || '',
      items: nota.items.map(it => ({ nama: it.nama, qty: it.qty, harga: it.harga })),
      subtotal: nota.total,
      total: nota.total,
      bayar: 0,
      kembali: 0,
      metodeBayar: 'BON',
      catatan: `${nota.selesai ? '' : 'BELUM LUNAS - '}${toko.catatan_struk || ''}`,
    }
    const escPos = buildEscPos(data, tpl.id)
    await printViaBluetooth(escPos, (status, msg) => {
      setBtStatus(status)
      setBtMsg(msg || '')
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-80 shadow-xl overflow-hidden">
        {/* Area nota (yang dicetak) — class struk-area harus ada utk CSS print.
          StrukModal memakai class itu; konsisten supaya print layout sama. */}
        <div className="struk-area relative overflow-hidden p-6 font-mono text-sm bg-white">
          <div className="text-center mb-4">
            <div className="text-base font-bold">{toko.nama || 'Toko'}</div>
            {toko.alamat && <div className="text-xs text-gray-500 mt-0.5 leading-snug">{toko.alamat}</div>}
            {toko.telepon && <div className="text-xs text-gray-500">Tel: {toko.telepon}</div>}
            <div className={`border-b ${tpl.dividerStyle === 'solid' ? 'border-solid' : 'border-dashed'} border-gray-300 my-3`} />
            {tpl.infoSebelumItems && (
              <div className="text-xs text-gray-400">
                <div>{waktu}</div>
                <div>No: Bon #{nota.id}</div>
                {nota.nama && <div>Nama: {nota.nama}</div>}
                {!nota.selesai && (
                  <div className="font-bold text-amber-600 mt-1">*** BON / BELUM LUNAS ***</div>
                )}
              </div>
            )}
          </div>

          <div className={`border-b ${tpl.dividerStyle === 'solid' ? 'border-solid' : 'border-dashed'} border-gray-300 mb-3`}>
            {nota.items.map((it, i) => (
              <div key={i} className="mb-1">
                <div className="truncate">{it.nama} x{it.qty}</div>
                <div className="text-right whitespace-nowrap">{fmt(it.subtotal)}</div>
              </div>
            ))}
          </div>

          <div className={`border-t ${tpl.dividerStyle === 'solid' ? 'border-solid' : 'border-dashed'} border-gray-300 pt-3 mb-3`}>
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL</span><span>{fmt(nota.total)}</span>
            </div>
          </div>

          {!tpl.infoSebelumItems && (
            <div className="text-xs text-gray-400 mb-4 space-y-0.5">
              <div>{waktu}</div>
              <div>No: Bon #{nota.id}</div>
              {nota.nama && <div>Nama: {nota.nama}</div>}
              {!nota.selesai && (
                <div className="font-bold text-amber-600">*** BON / BELUM LUNAS ***</div>
              )}
            </div>
          )}

          <div className="text-center text-xs text-gray-400 space-y-1">
            {toko.catatan_struk && <div>{toko.catatan_struk}</div>}
            <div>*** TERIMA KASIH ***</div>
            {tpl.footerPowered && <div className="text-gray-300 mt-1">Powered by Z1 Pos</div>}
          </div>
        </div>

        {/* Aksi */}
        <div className="no-print px-6 pb-6 pt-2 space-y-2">
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
                  ? <span className="text-[10px] text-slate-400">Printer: {savedPrinter}</span>
                  : <span className="text-[10px] text-slate-400">Belum ada printer tersimpan</span>}
                <button
                  onClick={async () => { const name = await selectPrinter(); if (name) setSavedPrinter(name) }}
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
          <button
            onClick={cetak}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            <Printer size={15} /> Cetak
          </button>
          <button onClick={onTutup} className="w-full py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
