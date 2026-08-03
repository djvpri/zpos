'use client'
import { useState, useEffect, useCallback } from 'react'
import { XLg, Search, FileEarmarkSpreadsheet, BoxSeam } from 'react-bootstrap-icons'

// Lihat isi katalog barcode pusat (global). Admin-only. Terbuka dari halaman
// produk via tombol "Katalog". Menampilkan total data, pencarian barcode/nama,
// dan tabel: barcode, nama, merek, kategori, sumber, terakhir dipakai.

interface Row {
  barcode: string
  nama: string
  merek: string | null
  kategori: string | null
  sumber: string
  hits: number
  dipakai_at: string | null
  created_at: string
}

interface Props { onTutup: () => void }

const SUMBER_LABEL: Record<string, string> = {
  seed: 'Seed', import: 'Impor', input: 'Input', saran: 'AI',
}

function fmtTgl(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function KatalogBarcodeModal({ onTutup }: Props) {
  const [cari, setCari] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (q: string) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/barcode-katalog/list?cari=${encodeURIComponent(q)}&limit=200`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal muat katalog')
      setRows(d.rows ?? [])
      setTotal(d.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal muat katalog')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce pencarian 250ms supaya tiap ketik tak spam API.
  useEffect(() => {
    const t = setTimeout(() => void load(cari), cari ? 250 : 0)
    return () => clearTimeout(t)
  }, [cari, load])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onTutup}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BoxSeam size={18} className="text-indigo-500" />
            <h3 className="font-bold text-gray-800">Katalog Barcode</h3>
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
              {total.toLocaleString('id-ID')} data
            </span>
          </div>
          <button onClick={onTutup} className="text-gray-400 hover:text-gray-600"><XLg size={18} /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={cari}
              onChange={e => setCari(e.target.value)}
              placeholder="Cari barcode atau nama..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[200px]">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {loading && !rows.length && <p className="text-sm text-gray-400 text-center py-8">Memuat...</p>}
          {!loading && rows.length === 0 && (
            <div className="text-center py-10">
              <FileEarmarkSpreadsheet size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{cari ? 'Tidak ada hasil untuk pencarian.' : 'Katalog masih kosong. Impor Excel dulu via tombol "Katalog" di halaman produk.'}</p>
            </div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-2 font-medium">Barcode</th>
                  <th className="pb-2 pr-2 font-medium">Nama</th>
                  <th className="pb-2 pr-2 font-medium">Merek</th>
                  <th className="pb-2 pr-2 font-medium">Kategori</th>
                  <th className="pb-2 pr-2 font-medium">Sumber</th>
                  <th className="pb-2 font-medium">Dipakai</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.barcode} className="border-b border-gray-50 align-top">
                    <td className="py-2 pr-2 font-mono text-xs text-gray-500">{r.barcode}</td>
                    <td className="py-2 pr-2 text-gray-800">{r.nama}</td>
                    <td className="py-2 pr-2 text-gray-500">{r.merek || '—'}</td>
                    <td className="py-2 pr-2">
                      {r.kategori
                        ? <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.kategori}</span>
                        : '—'}
                    </td>
                    <td className="py-2 pr-2 text-gray-500">{SUMBER_LABEL[r.sumber] || r.sumber}</td>
                    <td className="py-2 text-gray-500 text-xs whitespace-nowrap">{fmtTgl(r.dipakai_at)}</td>
                  </tr>
                ))}
                {rows.length >= 200 && (
                  <tr><td colSpan={6} className="py-3 text-center text-xs text-gray-400">Hasil dibatasi 200 baris — gunakan pencarian untuk menelusuri lebih lanjut.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
