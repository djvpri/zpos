'use client'
import { useState, useRef } from 'react'
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ProdukRow {
  nama: string; harga: number; stok: number; kategori: string
  deskripsi?: string; barcode?: string; expired_at?: string; stok_minimum?: number
}

interface Props { onSelesai: () => void; onTutup: () => void }

export default function ImportProduk({ onSelesai, onTutup }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'proses' | 'selesai'>('upload')
  const [produk, setProduk] = useState<ProdukRow[]>([])
  const [hasil, setHasil] = useState<{ berhasil: number; gagal: number; errors: string[] } | null>(null)
  const [error, setError] = useState('')

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['nama', 'harga', 'stok', 'kategori', 'deskripsi', 'barcode', 'expired_at', 'stok_minimum'],
      ['Indomie Goreng', 3500, 100, 'Makanan', 'Mie instan goreng', '', '', 10],
      ['Aqua 600ml', 3000, 50, 'Minuman', '', '', '', 5],
      ['Teh Botol Sosro', 4000, 80, 'Minuman', '', '', '2025-12-31', 5],
    ])
    ws['!cols'] = [20,10,8,15,20,15,12,12].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produk')
    XLSX.writeFile(wb, 'template_produk_zpos.xlsx')
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<any>(ws)

        const parsed: ProdukRow[] = rows
          .filter((r: any) => r.nama && r.harga)
          .map((r: any) => ({
            nama: String(r.nama || '').trim(),
            harga: Number(r.harga) || 0,
            stok: Number(r.stok) || 0,
            kategori: String(r.kategori || 'Umum').trim(),
            deskripsi: r.deskripsi ? String(r.deskripsi) : undefined,
            barcode: r.barcode ? String(r.barcode) : undefined,
            expired_at: r.expired_at ? String(r.expired_at).slice(0, 10) : undefined,
            stok_minimum: Number(r.stok_minimum) || 5,
          }))

        if (parsed.length === 0) { setError('File kosong atau format tidak sesuai template'); return }
        setProduk(parsed)
        setStep('preview')
      } catch {
        setError('Gagal membaca file. Pastikan format Excel (.xlsx) dan sesuai template.')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function simpanSemua() {
    setStep('proses')
    try {
      const res = await fetch('/api/produk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produk })
      })
      const data = await res.json()
      setHasil(data)
      setStep('selesai')
      if (data.berhasil > 0) onSelesai()
    } catch {
      setError('Gagal menyimpan ke server')
      setStep('preview')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-green-600" />
            <span className="font-semibold text-gray-800">Import Produk dari Excel</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Download template */}
              <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800 mb-1">1. Download Template</p>
                <p className="text-xs text-green-600 mb-3">Download template Excel, isi data produk, lalu upload kembali.</p>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition">
                  <Download size={16} /> Download Template Excel
                </button>
              </div>

              {/* Upload */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">2. Upload File Excel</p>
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition">
                  <Upload size={28} />
                  <span className="text-sm">Klik untuk pilih file .xlsx</span>
                  <span className="text-xs text-gray-300">atau drag & drop di sini</span>
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-600 mb-1">Format kolom yang didukung:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                  {['nama *', 'harga *', 'stok', 'kategori', 'deskripsi', 'barcode', 'expired_at', 'stok_minimum'].map(k => (
                    <span key={k} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">{produk.length} produk siap diimport</p>
                <button onClick={() => { setStep('upload'); setProduk([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600">Ganti file</button>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
                <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase">
                  <span>Nama</span><span>Harga</span><span>Stok</span><span>Kategori</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                  {produk.map((p, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-gray-700">
                      <span className="truncate font-medium">{p.nama}</span>
                      <span>Rp {p.harga.toLocaleString('id-ID')}</span>
                      <span>{p.stok}</span>
                      <span className="truncate text-gray-500">{p.kategori}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Proses */}
          {step === 'proses' && (
            <div className="py-8 text-center">
              <Loader2 size={40} className="mx-auto mb-3 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-gray-700">Menyimpan {produk.length} produk...</p>
              <p className="text-xs text-gray-400 mt-1">Mohon tunggu</p>
            </div>
          )}

          {/* Step: Selesai */}
          {step === 'selesai' && hasil && (
            <div className="py-6 text-center">
              <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
              <p className="text-base font-semibold text-gray-800 mb-1">Import Selesai!</p>
              <p className="text-sm text-gray-500">{hasil.berhasil} produk berhasil diimport</p>
              {hasil.gagal > 0 && (
                <div className="mt-3 rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-left">
                  <p className="text-xs font-medium text-yellow-700">{hasil.gagal} produk gagal:</p>
                  {hasil.errors.map((e, i) => <p key={i} className="text-xs text-yellow-600">· {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('upload'); setProduk([]) }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={simpanSemua}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                Import {produk.length} Produk
              </button>
            </>
          )}
          {(step === 'upload' || step === 'selesai') && (
            <button onClick={onTutup}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
              {step === 'selesai' ? 'Selesai' : 'Batal'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
