'use client'

import { useState, useRef } from 'react'
import { XLg, UpcScan, Printer, ArrowRepeat, CheckCircleFill, ExclamationCircle } from 'react-bootstrap-icons'
import { barcodeToSvg, generateProductBarcode } from '@/lib/barcode-code39'
import { Produk } from '@/types'

interface Props {
  produk: Produk[]
  onSelesai: () => void
  onTutup: () => void
  update: (id: number, p: Partial<Produk>) => Promise<{ message?: string } | null>
}

export default function BarcodeLabel({ produk, onSelesai, onTutup, update }: Props) {
  const tanpaBarcode = produk.filter(p => !p.barcode && !p._pending)
  const [terpilih, setTerpilih] = useState<Record<number, boolean>>(() => {
    const awal: Record<number, boolean> = {}
    produk.filter(p => !p.barcode && !p._pending).forEach(p => { awal[p.id] = true })
    return awal
  })

  const [status, setStatus] = useState<'pilih' | 'proses' | 'selesai'>('pilih')
  const [error, setError] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const selectedList = produk.filter(p => terpilih[p.id])

  function toggle(id: number) {
    setTerpilih(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Assign barcode ke semua produk terpilih (untuk yang belum punya)
  async function assignDanCetak() {
    if (!selectedList.length) { setError('Pilih minimal satu produk.'); return }
    setStatus('proses')
    let gagal = 0
    for (const p of selectedList) {
      if (!p.barcode) {
        const bc = generateProductBarcode(p.id)
        const res = await update(p.id, { barcode: bc })
        if (res) gagal++
      }
    }
    setStatus('selesai')
    if (gagal > 0) { setError(`${gagal} produk gagal disimpan (mungkin offline).`) }
    else onSelesai()
  }

  function printLabels() {
    // Generate fresh dari produk terpilih (barcode sudah tersimpan setelah assign)
    const el = printRef.current
    if (!el) return
    el.innerHTML = selectedList.map(p => {
      const bc = p.barcode
      if (!bc) return ''
      const svg = barcodeToSvg(bc, 50)
      return `<div class="label"><div class="label-svg">${svg}</div><div class="label-nama">${escapeHtml(p.nama)}</div><div class="label-bc">${escapeHtml(bc)}</div></div>`
    }).join('')
    // print via browser dialog
    const prevTitle = document.title
    document.title = 'Cetak Label Barcode'
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
            <UpcScan size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-800">Label Barcode Produk</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-gray-600 mb-3">
            {tanpaBarcode.length > 0
              ? `${tanpaBarcode.length} produk belum punya barcode. Centang untuk generate & cetak label.`
              : 'Semua produk sudah punya barcode. Centang untuk cetak ulang label.'}
          </p>

          {selectedList.length === 0 && (
            <div className="text-center py-10 text-gray-300 text-sm">Belum ada produk dipilih</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {produk.filter(p => p.barcode || tanpaBarcode.includes(p)).map(p => (
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
                <span className="truncate">{p.nama}</span>
                {!p.barcode && <span className="ml-auto text-[10px] text-amber-600 flex-shrink-0">tanpa bc</span>}
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
              <p className="text-sm text-gray-600">Menyimpan barcode ke {selectedList.length} produk...</p>
            </div>
          )}

          <div className="text-xs text-gray-400 mt-3">
            💡 Setelah simpan, label siap di-<b>cetak</b> ke printer (browser dialog). Format barcode = CODE39 numerik 13 digit, diawali &#39;2&#39;, unik per produk.
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Tutup</button>
          {!sedangProses && (
            <button
              onClick={assignDanCetak}
              disabled={!selectedList.length}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Simpan & Siapkan Label
            </button>
          )}
          {sudahSelesai && (
            <button
              onClick={printLabels}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Printer size={16} className="inline mr-1" /> Cetak Label
            </button>
          )}
        </div>
      </div>

      {/* Area print — disembunyikan di layar, muncul saat window.print() */}
      <style>{`
        @media screen {
          .zpos-print-area { display: none; }
        }
        @media print {
          body * { visibility: hidden !important; }
          .zpos-print-area, .zpos-print-area * { visibility: visible !important; }
          .zpos-print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
          .label { display: inline-block; width: 58mm; padding: 2mm; border-bottom: 1px dashed #ccc; page-break-inside: avoid; }
          .label-svg { text-align: center; }
          .label-nama { text-align: center; font-size: 10px; font-weight: 700; }
          .label-bc { text-align: center; font-size: 10px; }
        }
      `}</style>
      <div ref={printRef} className="zpos-print-area" />
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
