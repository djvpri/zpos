'use client'

import { useState, useRef } from 'react'
import { XLg, Printer, ArrowRepeat, CheckCircleFill, ExclamationCircle, Tag, Lightbulb } from 'react-bootstrap-icons'
import { barcodeToSvg, generateProductBarcode } from '@/lib/barcode-code39'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'

interface Props {
  produk: Produk[]
  onSelesai: () => void
  onTutup: () => void
  update: (id: number, p: Partial<Produk>) => Promise<{ message?: string } | null>
}

type Mode = 'barcode' | 'nama-harga' | 'lengkap'

// Modal label cetak gabungan: pilih produk → auto-generate barcode utk yg
// belum punya → pilih mode cetak (barcode / nama+harga / nama+harga+barcode)
// → cetak label via printer (browser dialog). Menggantikan BarcodeLabel +
// StickerHarga jadi satu fitur.
export default function LabelCetak({ produk, onTutup, update }: Props) {
  const tanpaBarcode = produk.filter(p => !p.barcode && !p._pending)
  const [terpilih, setTerpilih] = useState<Record<number, boolean>>(() => {
    const awal: Record<number, boolean> = {}
    produk.filter(p => !p._pending).forEach(p => { awal[p.id] = true })
    return awal
  })
  const [mode, setMode] = useState<Mode>('lengkap')
  const [status, setStatus] = useState<'pilih' | 'proses' | 'selesai'>('pilih')
  const [error, setError] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const selectedList = produk.filter(p => terpilih[p.id] && !p._pending)

  function toggle(id: number) {
    setTerpilih(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Daftar produk yang bisa dicetak (ekslusi pending)
  const selectable = produk.filter(p => !p._pending)

  // Tombol toggle: kalau SEMUA terpilih → "Kosongkan", kalau ada yang
  // belum → "Pilih Semua". Default modal buka dengan semua terpilih, jadi
  // kasir yang cuma mau cetak sebagian mulai dengan Kosongkan dulu.
  const semuaTerpilih = selectable.length > 0 && selectable.every(p => terpilih[p.id])

  function toggleSemua() {
    if (semuaTerpilih) {
      const kosong: Record<number, boolean> = {}
      selectable.forEach(p => { kosong[p.id] = false })
      setTerpilih(kosong)
    } else {
      const penuh: Record<number, boolean> = {}
      selectable.forEach(p => { penuh[p.id] = true })
      setTerpilih(penuh)
    }
  }

  // Assign barcode ke produk terpilih yang belum punya (kalau mode pakai barcode)
  async function assignDanCetak() {
    if (!selectedList.length) { setError('Pilih minimal satu produk.'); return }
    const perluBarcode = selectedList.filter(p => !p.barcode)
    if (perluBarcode.length > 0) {
      setStatus('proses')
      let gagal = 0
      for (const p of perluBarcode) {
        const bc = generateProductBarcode(p.id)
        const res = await update(p.id, { barcode: bc })
        if (res) gagal++
      }
      if (gagal > 0) {
        setStatus('pilih')
        setError(`${gagal} produk gagal disimpan (mungkin offline).`)
        return
      }
    }
    setStatus('selesai')
  }

  function buatHtml() {
    return selectedList.map(p => {
      const gunakanBarcode = mode !== 'nama-harga' && p.barcode
      const svg = gunakanBarcode ? barcodeToSvg(p.barcode!, 50) : ''
      const tampilNama = mode !== 'barcode'
      return `
      <div class="ctk-label">
        ${tampilNama ? `<div class="ctk-nama">${escapeHtml(p.nama)}</div>` : ''}
        ${tampilNama ? `<div class="ctk-harga">${fmt(p.harga)}</div>` : ''}
        ${gunakanBarcode ? `<div class="ctk-svg">${svg}</div><div class="ctk-bc">${escapeHtml(p.barcode!)}</div>` : ''}
      </div>`
    }).join('')
  }

  function print() {
    const prevTitle = document.title
    document.title = 'Cetak Label Produk'
    window.print()
    document.title = prevTitle
  }

  const sedangProses = status === 'proses'
  const sudahSelesai = status === 'selesai'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-800">Cetak Label Produk</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Toggle mode cetak */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit flex-wrap">
            {([['lengkap', 'Nama+Harga+Barcode'], ['nama-harga', 'Nama+Harga'], ['barcode', 'Barcode']] as [Mode, string][]).map(([m, lbl]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >{lbl}</button>
            ))}
          </div>

          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-sm text-gray-600">
              {tanpaBarcode.length > 0
                ? `${tanpaBarcode.length} produk belum punya barcode — akan digenerate otomatis saat cetak.`
                : 'Semua produk sudah punya barcode. Centang untuk cetak label.'}
            </p>
            <button
              onClick={toggleSemua}
              className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline disabled:opacity-50 disabled:no-underline"
              disabled={selectable.length === 0}
            >
              {semuaTerpilih ? 'Kosongkan semua' : 'Pilih semua'}
            </button>
          </div>

          {selectedList.length === 0 && (
            <div className="text-center py-10 text-gray-300 text-sm">Belum ada produk dipilih</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {produk.filter(p => !p._pending).map(p => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  terpilih[p.id] ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                }`}
              >
                <span className={`w-4 h-4 rounded flex-shrink-0 border ${terpilih[p.id] ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                  {terpilih[p.id] && <CheckCircleFill size={14} className="text-white m-auto" />}
                </span>
                <span className="truncate flex-1">{p.nama}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmt(p.harga)}</span>
                {!p.barcode && <span className="text-[9px] text-amber-600 flex-shrink-0">tanpa bc</span>}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              <ExclamationCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {sedangProses && (
            <div className="mt-4 py-6 text-center">
              <ArrowRepeat size={32} className="mx-auto mb-2 text-indigo-500 animate-spin" />
              <p className="text-sm text-gray-600">Menyimpan barcode ke produk...</p>
            </div>
          )}

          <div className="text-xs text-gray-400 mt-3">
            <Lightbulb size={13} className="inline mr-1 -mt-0.5" />Cetak via browser dialog ke printer label (58mm). Format barcode = CODE39 numerik 13 digit, diawali &#39;2&#39;, unik per produk.
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Tutup</button>
          {mode === 'barcode' && !sudahSelesai && (
            <button
              onClick={assignDanCetak}
              disabled={!selectedList.length}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Siapkan Barcode
            </button>
          )}
          {mode === 'lengkap' && !sudahSelesai && (
            <button
              onClick={assignDanCetak}
              disabled={!selectedList.length}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Siapkan & Cetak (generate barcode)
            </button>
          )}
          {(sudahSelesai || mode === 'nama-harga') && (
            <button
              onClick={() => { setStatus('selesai'); setTimeout(print, 50) }}
              disabled={!selectedList.length}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Printer size={16} className="inline mr-1" /> Cetak ({selectedList.length})
            </button>
          )}
        </div>
      </div>

      {/* Area print — disembunyikan di layar, muncul saat window.print() */}
      <style>{`
        @media screen { .ctk-print-area { display: none; } }
        @media print {
          body * { visibility: hidden !important; }
          .ctk-print-area, .ctk-print-area * { visibility: visible !important; }
          .ctk-print-area { display: flex !important; flex-wrap: wrap; gap: 2mm; position: absolute; left: 0; top: 0; width: 100%; }
          .ctk-label { width: 58mm; padding: 2mm; border-bottom: 1px dashed #ccc; page-break-inside: avoid; box-sizing: border-box; }
          .ctk-nama { font-size: 9px; font-weight: 700; color: #333; text-align: center; overflow: hidden; white-space: nowrap; }
          .ctk-harga { font-size: 20px; font-weight: 800; color: #000; text-align: center; }
          .ctk-svg { text-align: center; }
          .ctk-bc { text-align: center; font-size: 10px; }
        }
      `}</style>
      <div ref={printRef} className="ctk-print-area" dangerouslySetInnerHTML={{ __html: sudahSelesai ? buatHtml() : '' }} />
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
