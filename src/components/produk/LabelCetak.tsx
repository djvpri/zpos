'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { XLg, Printer, ArrowRepeat, CheckCircleFill, ExclamationCircle, Tag, Lightbulb } from 'react-bootstrap-icons'
import { barcodeToSvg, generateProductBarcode } from '@/lib/barcode-code39'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'

interface Props {
  produk: Produk[]
  onSelesai: () => void
  onTutup: () => void
  update: (id: number, p: Partial<Produk>) => Promise<{ message?: string } | null>
  ukuran?: UkuranLabel   // opsional; bila di-set, modal ini pakai W×H label lain (default 50×30)
}

type UkuranLabel = { w: number; h: number }

type Mode = 'barcode' | 'nama-harga' | 'lengkap'

// Preset ukuran label (mm). Barcode height dihitung proporsional thd tinggi label.
const UKURAN_PRESET: { label: string; uk: UkuranLabel }[] = [
  { label: '50 × 30 mm',  uk: { w: 50, h: 30 } },
  { label: '40 × 30 mm',  uk: { w: 40, h: 30 } },
  { label: '60 × 40 mm',  uk: { w: 60, h: 40 } },
  { label: '30 × 20 mm',  uk: { w: 30, h: 20 } },
]
// Tinggi barcode (mm) mengikuti tinggi label — sisakan ruang nama+harga+nomor.
function bcHeight(h: number): number {
  return Math.min(22, Math.max(8, h - 16))
}

// Modal label cetak gabungan: pilih produk → auto-generate barcode utk yg
// belum punya → pilih mode cetak (barcode / nama+harga / nama+harga+barcode)
// → cetak label via printer (browser dialog). Menggantikan BarcodeLabel +
// StickerHarga jadi satu fitur.
export default function LabelCetak({ produk, onTutup, update, ukuran: ukuranProp }: Props) {
  const tanpaBarcode = produk.filter(p => !p.barcode && !p._pending)
  const [terpilih, setTerpilih] = useState<Record<number, boolean>>(() => {
    const awal: Record<number, boolean> = {}
    produk.filter(p => !p._pending).forEach(p => { awal[p.id] = true })
    return awal
  })
  const [mode, setMode] = useState<Mode>('lengkap')
  const [kata, setKata] = useState('') // pencarian lihat daftar produk
  const [ukuran, setUkuran] = useState<UkuranLabel>(() => {
    // Default mengikuti settingan terakhir (persist localStorage). Prop eksplisit
    // menang; kalau tak ada prop, baca localStorage; kalau kosong → 50×30.
    if (ukuranProp) return ukuranProp
    try {
      const s = localStorage.getItem('zpos_ukuran_label')
      if (s) { const p = JSON.parse(s); if (p && Number(p.w) > 0 && Number(p.h) > 0) return { w: Number(p.w), h: Number(p.h) } }
    } catch { /* ignore */ }
    return { w: 50, h: 30 }
  })
  const [custom, setCustom] = useState<UkuranLabel>({ w: 40, h: 30 }) // input custom W×H
  // Simpan pilihan ukuran biar dipakai sebagai default di cetak berikutnya.
  const gantiUkuran = (u: UkuranLabel) => {
    setUkuran(u)
    try { localStorage.setItem('zpos_ukuran_label', JSON.stringify(u)) } catch { /* ignore */ }
  }
  const [status, setStatus] = useState<'pilih' | 'proses' | 'selesai'>('pilih')
  const [error, setError] = useState('')
  const [printRoot, setPrintRoot] = useState<HTMLElement | null>(null)

  // Aksesori print diportal ke child PERTAMA body (bukan append): saat print
  // area mulai di atas semua konten app — bukan setelahnya — sehingga label
  // mulai kiri-atas halaman 1 (fix halaman-1-kosong). App tetap visibility
  // hidden saat print.
  useEffect(() => {
    const d = document.createElement('div')
    d.setAttribute('data-print-root', '')
    document.body.prepend(d)
    setPrintRoot(d)
    return () => { d.remove() }
  }, [])

  const selectedList = produk.filter(p => terpilih[p.id] && !p._pending)

  function toggle(id: number) {
    setTerpilih(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Daftar produk yang bisa dicetak (ekslusi pending)
  const selectable = produk.filter(p => !p._pending)

  // Pencarian: filter grid tampilan (nama/barcode cocok). "Pilih semua" tetap
  // memakai seluruh `selectable` biar tak mengubah semantik seleksi.
  const q = kata.trim().toLowerCase()
  const selectableF = selectable.filter(p =>
    !q || p.nama.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))
  )

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
      const svg = gunakanBarcode ? barcodeToSvg(p.barcode!, mode === 'barcode' ? 70 : 45) : ''
      const tampilNama = mode !== 'barcode'
      return `
      <div class="ctk-label">
        ${tampilNama ? `<div class="ctk-nama">${escapeHtml(p.nama)}</div>` : ''}
        ${tampilNama ? `<div class="ctk-harga">${fmt(p.harga)}</div>` : ''}
        ${gunakanBarcode ? `<div class="ctk-bc">${escapeHtml(p.barcode!)}</div><div class="ctk-svg">${svg}</div>` : ''}
      </div>`
    }).join('')
  }

  const sedangProses = status === 'proses'
  const sudahSelesai = status === 'selesai'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ '--ctk-h': `${ukuran.h}mm`, '--ctk-w': `${ukuran.w}mm`, '--ctk-bc': `${bcHeight(ukuran.h)}mm` } as CSSProperties}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-800">Cetak Label Produk</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Ukuran label (mm) — pilih preset atau custom. Waktu cetak, atur juga
              ukuran paper yg sama di dialog printer/driver. */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Ukuran label:</span>
            <div className="flex gap-1 flex-wrap">
              {UKURAN_PRESET.map(p => (
                <button
                  key={`${p.uk.w}x${p.uk.h}`}
                  onClick={() => gantiUkuran(p.uk)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${ukuran.w === p.uk.w && ukuran.h === p.uk.h ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-200'}`}
                >{p.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Custom</span>
              <input
                type="number" value={custom.w} min={20} max={100}
                onChange={e => setCustom(c => ({ ...c, w: Math.max(10, Number(e.target.value) || 50) }))}
                className="w-14 rounded border border-gray-200 py-1 px-1.5 text-center focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-gray-400">×</span>
              <input
                type="number" value={custom.h} min={15} max={60}
                onChange={e => setCustom(c => ({ ...c, h: Math.max(10, Number(e.target.value) || 30) }))}
                className="w-14 rounded border border-gray-200 py-1 px-1.5 text-center focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-gray-400">mm</span>
              <button
                onClick={() => gantiUkuran(custom)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-indigo-200"
              >Pakai</button>
            </div>
          </div>

          {/* Toggle mode cetak */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-2 w-fit flex-wrap">
            {([['lengkap', 'Nama+Harga+Barcode'], ['nama-harga', 'Nama+Harga'], ['barcode', 'Barcode']] as [Mode, string][]).map(([m, lbl]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >{lbl}</button>
            ))}
          </div>

          {/* Pencarian produk */}
          <div className="relative mb-3">
            <input
              value={kata}
              onChange={e => setKata(e.target.value)}
              placeholder="Cari nama atau barcode produk…"
              className="w-full rounded-xl border border-gray-200 py-2 pl-4 pr-9 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <button
              onClick={() => setKata('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600"
              aria-label="Hapus pencarian"
            >
              <XLg size={13} />
            </button>
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
            {selectableF.map(p => (
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
            {selectableF.length === 0 && (
              <div className="col-span-full text-center py-8 text-sm text-gray-300">{q ? 'Produk tidak ditemukan' : 'Belum ada produk'}</div>
            )}
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
            <Lightbulb size={13} className="inline mr-1 -mt-0.5" />Cetak via browser dialog ke printer label. Ukuran kertas diatur lewat driver/printer (CT221B) — pastikan paper-nya label yg sesuai. Format barcode = CODE39 numerik, unik per produk.
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
              onClick={() => { setStatus('selesai'); setTimeout(() => window.print(), 60) }}
              disabled={!selectedList.length}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Printer size={16} className="inline mr-1" /> Cetak ({selectedList.length})
            </button>
          )}
      </div>
      {/* Area print — portal ke child-pertama body (prepend). Saat print:
          semua konten app visibility:hidden (TERBUKTI mencetak di printer
          thermal, beda dgn display:none yang bikin kosong), aksesori print
          tampil penuh di posisi asalnya = awal body = kiri-atas halaman 1,
          page-break antar label = 1 label per halaman. */}
      <style>{`
        @page { size: auto; margin: 0; }
        @media print {
          body > *:not([data-print-root]) { display: none !important; }
          html, body { margin: 0 !important; }
          .ctk-print-area { display: block !important; position: static !important; width: 100%; box-sizing: border-box; }
          .ctk-label { display: block; width: 100%; height: var(--ctk-h, 30mm); padding: 1mm 2mm 0.5mm; box-sizing: border-box; text-align: center; font-family: system-ui, Arial, sans-serif; overflow: hidden; }
          .ctk-nama { font-size: 8px; font-weight: 700; color: #333; text-align: center; overflow-wrap: break-word; }
          .ctk-harga { font-size: 18px; font-weight: 800; color: #000; text-align: center; }
          .ctk-svg { text-align: center; width: 100%; }
          .ctk-svg svg { height: var(--ctk-bc, 14mm); width: auto; display: inline-block; max-width: 100%; }
          .ctk-bc { text-align: center; font-size: 10px; font-weight: 700; color: #000; margin-top: 0.5mm; }
        }
      `}</style>
      {printRoot && createPortal(
        <div className="ctk-print-area" dangerouslySetInnerHTML={{ __html: sudahSelesai ? buatHtml() : '' }} />,
        printRoot
      )}
    </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
