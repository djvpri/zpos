'use client'

import { useState } from 'react'
import { XLg, Tag, Printer, CheckCircleFill } from 'react-bootstrap-icons'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'

interface Props {
  produk: Produk[]
  onTutup: () => void
}

export default function StickerHarga({ produk, onTutup }: Props) {
  const [terpilih, setTerpilih] = useState<Record<number, boolean>>(() => {
    const awal: Record<number, boolean> = {}
    produk.filter(p => !p._pending).forEach(p => { awal[p.id] = true })
    return awal
  })
  const [mode, setMode] = useState<'nama-harga' | 'harga-saja'>('nama-harga')
  const [cetakReady, setCetakReady] = useState(false)

  const selected = produk.filter(p => terpilih[p.id])

  function toggle(id: number) {
    setTerpilih(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function buatHtml() {
    return selected.map(p => `
      <div class="harga-label">
        ${mode === 'nama-harga' ? `<div class="harga-nama">${escapeHtml(p.nama)}</div>` : ''}
        <div class="harga-harga">Rp${fmt(p.harga)}</div>
        <div class="harga-toko">${mode === 'nama-harga' ? '&nbsp;' : ''}</div>
      </div>
    `).join('')
  }

  function print() {
    // Print dialog browser — area label di .sticker-print-area
    const prevTitle = document.title
    document.title = 'Cetak Stiker Harga'
    window.print()
    document.title = prevTitle
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-green-600" />
            <span className="font-semibold text-gray-800">Cetak Stiker Harga</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-3 w-fit">
            <button
              onClick={() => setMode('nama-harga')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'nama-harga' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >Nama + Harga</button>
            <button
              onClick={() => setMode('harga-saja')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'harga-saja' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >Harga Saja</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto mb-4">
            {produk.filter(p => !p._pending).map(p => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${terpilih[p.id] ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-200'}`}
              >
                <span className={`w-4 h-4 rounded flex-shrink-0 border ${terpilih[p.id] ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                  {terpilih[p.id] && <CheckCircleFill size={14} className="text-white m-auto" />}
                </span>
                <span className="truncate flex-1">{p.nama}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">Rp{fmt(p.harga)}</span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-dashed border-gray-300 p-3 flex flex-wrap gap-2">
            {selected.slice(0, 6).map(p => (
              <div key={p.id} className="border border-gray-200 rounded-lg px-3 py-1.5 w-28">
                {mode === 'nama-harga' && <div className="text-[9px] text-gray-500 truncate text-center">{p.nama}</div>}
                <div className="text-sm font-bold text-green-700 text-center">Rp{fmt(p.harga)}</div>
              </div>
            ))}
            {selected.length > 6 && <div className="text-xs text-gray-400 self-center">+{selected.length - 6} lagi</div>}
          </div>

          <div className="text-xs text-gray-400 mt-3">
            💡 Cetak via browser dialog ke printer label (58mm). Baris/kolom label menyesuaikan kertas.
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Tutup</button>
          <button
            onClick={() => { setCetakReady(true); setTimeout(print, 50) }}
            disabled={!selected.length}
            className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Printer size={16} className="inline mr-1" /> Cetak ({selected.length})
          </button>
        </div>
      </div>

      {/* Area print: isi lewat DOM injection saat cetak */}
      <style>{`
        .sticker-print-area { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .sticker-print-area, .sticker-print-area * { visibility: visible !important; }
          .sticker-print-area { display: flex !important; flex-wrap: wrap; gap: 2mm; position: absolute; left: 0; top: 0; width: 100%; }
          .harga-label { width: 58mm; padding: 3mm; border: 1px solid #ccc; page-break-inside: avoid; box-sizing: border-box; }
          .harga-nama { font-size: 8px; color: #333; text-align: center; overflow: hidden; white-space: nowrap; }
          .harga-harga { font-size: 20px; font-weight: 800; color: #000; text-align: center; }
        }
      `}</style>
      <div className="sticker-print-area" dangerouslySetInnerHTML={{ __html: cetakReady ? buatHtml() : '' }} />
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
