'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { XLg, Printer, ArrowRepeat, CheckCircleFill, ExclamationCircle, Tag, Lightbulb } from 'react-bootstrap-icons'
import { barcodeToSvg, generateProductBarcode } from '@/lib/barcode-code39'
import { qrToSvg } from '@/lib/qrcode'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'

interface Props {
  produk: Produk[]
  onSelesai: () => void
  onTutup: () => void
  update: (id: number, p: Partial<Produk>) => Promise<{ message?: string } | null>
  ukuranLabel?: string                          // default ukuran dari DB "WxH" (per-toko)
  onSimpanUkuran?: (u: { w: number; h: number }) => void
}

type UkuranLabel = { w: number; h: number }

// Parse string "WxH" (dari DB/localStorage) jadi angka; fallback 50×30.
function parseUkuran(s: string | null | undefined): UkuranLabel {
  const m = /^(\d+)x(\d+)$/.exec(s || '')
  if (m) { const w = Number(m[1]), h = Number(m[2]); if (w > 0 && h > 0) return { w, h } }
  return { w: 50, h: 30 }
}

type Mode = 'barcode' | 'nama-harga' | 'lengkap'
// Tipe kode di label (mode yg mencetak kode): 1D barcode saja ATAU 2D QR saja,
// tidak dua-duanya sekaligus. Default 1D (backward-compat: label tetap
// barcode 1D utk pengguna yg tak pilih apa-apa).
type KodeTipe = '1d' | '2d'

// Preset ukuran label (mm). Barcode height dihitung proporsional thd tinggi label.
const UKURAN_PRESET: { label: string; uk: UkuranLabel }[] = [
  { label: '50 × 30 mm',  uk: { w: 50, h: 30 } },
  { label: '40 × 30 mm',  uk: { w: 40, h: 30 } },
  { label: '60 × 40 mm',  uk: { w: 60, h: 40 } },
  { label: '30 × 20 mm',  uk: { w: 30, h: 20 } },
]

// Modal label cetak gabungan: pilih produk → auto-generate barcode utk yg
// belum punya → pilih mode cetak (barcode / nama+harga / nama+harga+barcode)
// → cetak label via printer (browser dialog). Menggantikan BarcodeLabel +
// StickerHarga jadi satu fitur.
export default function LabelCetak({ produk, onTutup, update, ukuranLabel, onSimpanUkuran }: Props) {
  const tanpaBarcode = produk.filter(p => !p.barcode && !p._pending)
  const [terpilih, setTerpilih] = useState<Record<number, boolean>>(() => {
    const awal: Record<number, boolean> = {}
    produk.filter(p => !p._pending).forEach(p => { awal[p.id] = true })
    return awal
  })
  const [mode, setMode] = useState<Mode>('lengkap')
  const [kodeTipe, setKodeTipe] = useState<KodeTipe>('1d')
  const [kata, setKata] = useState('') // pencarian lihat daftar produk
  const [ukuran, setUkuran] = useState<UkuranLabel>(() => {
    // Default = settingan per-toko dari DB (ukuranLabel prop). Kalau user pernah
    // mengubah di browser ini (localStorage), override lokal menang sbg cadangan.
    try {
      const s = localStorage.getItem('zpos_ukuran_label')
      if (s) { const p = parseUkuran(s); return p }
    } catch { /* ignore */ }
    return parseUkuran(ukuranLabel)
  })
  const kecil = ukuran.w <= 35 // label sempit: fokus harga+barcode, nama/nomor tak tampil
  // Input custom W×H sbg STRING (bukan number) — controlled-number di browser
  // nyambung angka secara lompatan & clamp via Number() di onChange ngerusak
  // ketikan (hps "40"→"10", ketik "25"→"1025"). Ketik bebas, parse saat apply.
  const [cw, setCw] = useState(() => String(ukuran.w)) // ikut ukuran aktif saat modal dibuka
  const [ch, setCh] = useState(() => String(ukuran.h))
  const [dipakai, setDipakai] = useState(false) // feedback visual tombol Pakai
  const pakaiRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // QR SVG per produk id (nanti id<0 berarti... tak, id produk >=1). Dibangun async
  // di assignDanCetak sbg pendamping barcode 1D di label (QR lebih mudah discan
  // saat 1D terlalu rapat di sticker kecil 25×15mm). Kosong kalau belum dibangun.
  const [qrMap, setQrMap] = useState<Record<number, string>>({})
  const sanitize = (s: string) => s.replace(/[^\d]/g, '') // hanya digit
  // Terapkan custom: parse, clamp rentang wajar, persist.
  const gantiCustom = () => {
    const w = Math.min(120, Math.max(10, parseInt(cw, 10) || 50))
    const h = Math.min(60, Math.max(10, parseInt(ch, 10) || 30))
    setCw(String(w)); setCh(String(h))
    gantiUkuran({ w, h })
    // Umpan balik visual: hijau ~1.5s utk konfirmasi berhasil dipakai.
    setDipakai(true)
    if (pakaiRef.current) clearTimeout(pakaiRef.current)
    pakaiRef.current = setTimeout(() => setDipakai(false), 1500)
  }
  // Terapkan ukuran & simpan: ke DB per-toko (via callback) + localStorage
  // cadangan biar instan/sinkron di browser ini.
  const gantiUkuran = (u: UkuranLabel) => {
    setUkuran(u)
    setCw(String(u.w)); setCh(String(u.h)) // custom field ikut preset yg dipilih
    try { localStorage.setItem('zpos_ukuran_label', `${u.w}x${u.h}`) } catch { /* ignore */ }
    onSimpanUkuran?.(u)
  }
  const [status, setStatus] = useState<'pilih' | 'proses' | 'selesai'>('pilih')
  const [error, setError] = useState('')
  // Aksesori print diportal ke child PERTAMA body (bukan append): saat print
  // area mulai di atas semua konten app — bukan setelahnya — sehingga label
  // mulai kiri-atas halaman 1 (fix halaman-1-kosong). App tetap visibility
  // hidden saat print. Node dibuat sekali saat mount (lazy init), dihapus di
  // unmount — tak perlu setState dalam effect.
  const [printRoot] = useState(() => {
    const d = document.createElement('div')
    d.setAttribute('data-print-root', '')
    document.body.prepend(d)
    return d
  })
  useEffect(() => () => { printRoot.remove() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- printRoot stabil (lazy init, tak pernah berubah)

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
        // Wajib sertakan id di body — produkUpdateSchema minta id positif (zod),
        // tanpa id PUT /api/produk/:id kena 400 -> update() balik error -> salah
        // dituding "offline". Lihat pola update() lain yg sertakan {id}.
        const res = await update(p.id, { id: p.id, barcode: bc } as Partial<Produk>)
        if (res) gagal++
      }
      if (gagal > 0) {
        setStatus('pilih')
        setError(`${gagal} produk gagal disimpan (mungkin offline).`)
        return
      }
    }
    setStatus('selesai')
    // Bangun QR hanya kalau mode 2D dipilih. Kalau 1D, tak perlu kerja ekstra.
    if (kodeTipe === '2d') {
      // QR = kode 2D tunggal di label (tanpa barcode 1D).
      const qr: Record<number, string> = {}
      await Promise.all(selectedList.map(async p => {
        const val = p.barcode || generateProductBarcode(p.id)
        const s = await qrToSvg(val, kecil ? 160 : 240, kecil ? 3 : 4).catch(() => '')
        if (s) qr[p.id] = s
      }))
      setQrMap(qr)
    } else {
      setQrMap({})
    }
  }

  function buatHtml() {
    return selectedList.map(p => {
      const gunakanBarcode = mode !== 'nama-harga' && p.barcode
      const tampilNama = mode !== 'barcode' && !kecil
      const qr = kodeTipe === '2d' ? qrMap[p.id] || '' : ''
      // Render kode sesuai tipe: 1D = barcode saja, 2D = QR saja. Tidak
      // dua-duanya sekaligus di satu label.
      const blokBc = gunakanBarcode
        ? kodeTipe === '2d'
          ? (qr ? `<div class="ctk-svg ctk-2d">${qr}</div>` : `<div class="ctk-svg ctk-1d">${barcodeToSvg(p.barcode!, kecil ? 10 : 18, kecil ? 0.25 : 0.25)}</div>`)
          : `${kecil ? '' : `<div class="ctk-bc">${escapeHtml(p.barcode!)}</div>`}<div class="ctk-svg ctk-1d">${barcodeToSvg(p.barcode!, kecil ? 10 : 18, kecil ? 0.25 : 0.25)}</div>`
        : ''
      return `
      <div class="ctk-label${kecil ? ' ctk-small' : ''}">
        ${tampilNama ? `<div class="ctk-nama">${escapeHtml(p.nama)}</div>` : ''}
        ${gunakanBarcode || tampilNama ? `<div class="ctk-harga">${fmt(p.harga)}</div>` : ''}
        ${blokBc}
      </div>`
    }).join('')
  }

  const sedangProses = status === 'proses'
  const sudahSelesai = status === 'selesai'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ '--ctk-h': `${ukuran.h}mm`, '--ctk-w': `${ukuran.w}mm`, '--ctk-bc': `${Math.max(4, ukuran.h * 0.47)}mm` } as CSSProperties}
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
                type="text" inputMode="numeric" value={cw} placeholder="40"
                onChange={e => setCw(sanitize(e.target.value))}
                className="w-14 rounded border border-gray-200 py-1 px-1.5 text-center focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-gray-400">×</span>
              <input
                type="text" inputMode="numeric" value={ch} placeholder="30"
                onChange={e => setCh(sanitize(e.target.value))}
                className="w-14 rounded border border-gray-200 py-1 px-1.5 text-center focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-gray-400">mm</span>
              <button
                type="button"
                onClick={gantiCustom}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1 ${dipakai ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600'}`}
              >{dipakai ? <><CheckCircleFill size={12} /> Dipakai</> : 'Pakai'}</button>
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

          {/* Tipe kode di label — hanya tampil utk mode yg mencetak kode.
              Pilih satu: 1D barcode saja ATAU 2D QR saja, tak dua-duanya. */}
          {(mode === 'lengkap' || mode === 'barcode') && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-2 w-fit flex-wrap">
              <span className="px-2 text-xs font-medium text-gray-400">Kode:</span>
              {([['1d', '1D Barcode'], ['2d', '2D QR']] as [KodeTipe, string][]).map(([t, lbl]) => (
                <button
                  key={t}
                  onClick={() => setKodeTipe(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${kodeTipe === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >{lbl}</button>
              ))}
            </div>
          )}

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
            <Lightbulb size={13} className="inline mr-1 -mt-0.5" />Cetak via browser dialog ke printer label. Ukuran kertas diatur lewat driver/printer (CT221B) — pastikan paper-nya label yg sesuai. Barcode auto: 13 digit → EAN-13, numerik genap → Code128, lain → CODE39. Pilih jenis kode: <strong>1D Barcode</strong> atau <strong>2D QR</strong> — satu label satu jenis kode (tak dicetak keduanya).
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
              Siapkan {kodeTipe === '2d' ? 'QR' : 'Barcode'}
            </button>
          )}
          {mode === 'lengkap' && !sudahSelesai && (
            <button
              onClick={assignDanCetak}
              disabled={!selectedList.length}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Siapkan & Cetak (generate {kodeTipe === '2d' ? 'QR' : 'barcode'})
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
        @page { size: var(--ctk-w, 50mm) var(--ctk-h, 30mm); margin: 0; }
        @media print {
          body > *:not([data-print-root]) { display: none !important; }
          html, body { margin: 0 !important; }
          .ctk-print-area { display: block !important; position: static !important; width: var(--ctk-w, 50mm); box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; }
          .ctk-label { display: flex; flex-direction: column; justify-content: center; width: var(--ctk-w, 50mm); height: var(--ctk-h, 30mm); padding: calc(var(--ctk-h) * 0.02) calc(var(--ctk-w) * 0.04); box-sizing: border-box; text-align: center; font-family: system-ui, Arial, sans-serif; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
          .ctk-nama { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; font-size: calc(var(--ctk-h) * 0.085); font-weight: 700; color: #333; overflow-wrap: break-word; line-height: 1.1; overflow: hidden; min-height: 0; }
          .ctk-harga { flex: 0 0 auto; font-size: calc(var(--ctk-h) * 0.17); font-weight: 800; color: #000; line-height: 1.2; }
          .ctk-small .ctk-harga { margin-bottom: calc(var(--ctk-h) * 0.01); font-size: calc(var(--ctk-h) * 0.13); line-height: 1.0; }
          .ctk-svg { flex: 1 1 auto; min-height: 0; text-align: center; display: flex; align-items: center; justify-content: center; margin-top: calc(var(--ctk-h) * 0.02); }
          .ctk-small .ctk-svg { margin-top: calc(var(--ctk-h) * 0.01); margin-bottom: calc(var(--ctk-h) * 0.01); padding-top: 0; }
          .ctk-svg svg { width: 100%; height: auto; display: block; }
          /* Barcode 1D: SVG sudah ber-dimensi FISIK mm (lebar intrinsic dlm atribut
             width="..mm"). JANGAN squash (width:100% di atas) — pakai ukuran
             intrinsic 1:1 supaya preview layar == hasil print tajam. overflow:hidden
             label potong kalau barcode > label (modul tak di-raster ulang). */
          .ctk-1d svg { width: auto; height: auto; max-width: 100%; }
          /* 2D QR: isi setinggi ruang tersisa (setelah harga), width auto jaga
             rasio 1:1 -> sebesar mungkin di label sempit. */
          .ctk-small .ctk-2d svg { width: auto; height: 100%; max-width: 100%; }
          .ctk-bc { flex: 0 0 auto; font-size: calc(var(--ctk-h) * 0.095); font-weight: 700; color: #000; margin-top: calc(var(--ctk-h) * 0.015); }
        }
      `}</style>
      {printRoot && createPortal(
        <div
          className="ctk-print-area"
          style={{ '--ctk-h': `${ukuran.h}mm`, '--ctk-w': `${ukuran.w}mm`, '--ctk-bc': `${Math.max(4, ukuran.h * 0.47)}mm` } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: sudahSelesai ? buatHtml() : '' }}
        />,
        printRoot
      )}
    </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
