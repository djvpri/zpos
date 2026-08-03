'use client'
import { useState, useRef } from 'react'
import { Upload, XLg, CheckCircleFill, ExclamationCircle, FileEarmarkSpreadsheet } from 'react-bootstrap-icons'
import * as XLSX from 'xlsx'

// Import Barcode Katalog (global, lintas toko). Layar: admin memilih file Excel
// berisi kolom barcode / nama / (opsional) merek / (opsional) kategori, lalu
// di-upload ke server. Data memperkaya katalog pusat yang dipakai utk
// auto-suggest nama saat kasir input produk baru.

interface Props { onTutup: () => void }

interface Hasil {
  berhasil: number
  gagal: number
  errors: { baris: number; pesan: string }[]
}

const TEMPLATE: Record<string, string>[] = [
  { barcode: '8991002100013', nama: 'Indomie Goreng', merek: 'Indofood', kategori: 'Makanan' },
  { barcode: '8993204000012', nama: 'Teh Botol Sosro', merek: 'Sosro', kategori: 'Minuman' },
]

export default function ImportBarcodeKatalog({ onTutup }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'proses' | 'selesai'>('upload')
  const [count, setCount] = useState(0)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [error, setError] = useState('')
  const [fname, setFname] = useState('')

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE)
    ws['!cols'] = [16, 28, 12, 14].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Katalog')
    XLSX.writeFile(wb, 'template_barcode_katalog.xlsx')
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setHasil(null); setStep('upload')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
        const items = rows
          .filter(r => String(r.barcode ?? '').trim() && String(r.nama ?? '').trim())
          .map(r => ({
            barcode: String(r.barcode).trim().replace(/\D/g, ''), // bersihkan spasi/hyphen
            nama: String(r.nama).trim(),
            merek: r.merek ? String(r.merek).trim() : undefined,
            kategori: r.kategori ? String(r.kategori).trim() : undefined,
          }))
        if (!items.length) { setError('File kosong atau kolom tidak sesuai template'); return }
        setCount(items.length)
        setFname(file.name)
        setStep('proses')
        void upload(items)
      } catch {
        setError('Gagal membaca file. Pastikan format Excel (.xlsx/.xls).')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function upload(items: { barcode: string; nama: string; merek?: string; kategori?: string }[]) {
    try {
      const res = await fetch('/api/barcode-katalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Gagal impor.'); setStep('upload'); return }
      setHasil({ berhasil: data.berhasil ?? 0, gagal: data.gagal ?? 0, errors: data.errors ?? [] })
      setStep('selesai')
    } catch {
      setError('Gagal terhubung ke server.'); setStep('upload')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onTutup}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Import Katalog Barcode</h3>
          <button onClick={onTutup} className="text-gray-400 hover:text-gray-600"><XLg size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Kolom: <code>barcode, nama</code> + opsional <code>merek, kategori</code>. Data masuk ke katalog
          barcode pusat dan otomatis muncul sebagai saran nama saat kasir input produk. Barcode yang sudah ada di-update.
        </p>

        {step === 'upload' && (
          <>
            {error && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <ExclamationCircle size={13} className="inline mr-1 -mt-0.5" />{error}
              </p>
            )}
            <button onClick={downloadTemplate} className="text-xs text-indigo-600 hover:underline mb-3">
              Download template Excel
            </button>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
            >
              <FileEarmarkSpreadsheet size={28} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Pilih file Excel berisi katalog barcode</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx atau .xls</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
          </>
        )}

        {step === 'proses' && (
          <div className="text-center py-8">
            <Upload size={24} className="mx-auto text-indigo-500 mb-3" />
            <p className="text-sm text-gray-700">Mengimpor <b>{count.toLocaleString('id-ID')}</b> baris dari <b>{fname}</b>...</p>
            <p className="text-xs text-gray-400 mt-1">Bisa butuh beberapa detik untuk data besar.</p>
          </div>
        )}

        {step === 'selesai' && hasil && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircleFill size={18} />
              Selesai: <b>{hasil.berhasil.toLocaleString('id-ID')}</b> baris sukses
              {hasil.gagal > 0 && <span className="text-red-600 font-normal"> · {hasil.gagal.toLocaleString('id-ID')} gagal</span>}
            </div>
            {hasil.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 text-xs">
                {hasil.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="px-3 py-1.5 border-b border-red-50 text-red-600">
                    Baris {e.baris}: {e.pesan}
                  </div>
                ))}
                {hasil.errors.length > 50 && <div className="px-3 py-1.5 text-gray-400">...dan {hasil.errors.length - 50} lagi</div>}
              </div>
            )}
            <button
              onClick={onTutup}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
