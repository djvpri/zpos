'use client'
import { useState, useRef } from 'react'
import { XLg, QrCodeScan, UpcScan, Trash, CheckLg, ArrowRepeat, Box, ExclamationCircle, Bag } from 'react-bootstrap-icons'
import dynamic from 'next/dynamic'
import { useKategori } from '@/hooks/useKategori'
import { Produk } from '@/types'

const BarcodeCameraModal = dynamic(
  () => import('@/components/kasir/BarcodeScanner').then(m => m.BarcodeCameraModal),
  { ssr: false }
)

interface ProdukScan {
  barcode: string
  nama: string
  harga: number
  stok: number
  kategori: string
  foto_url?: string
  status: 'loading' | 'found' | 'manual'
}

interface Props {
  onSelesai: () => void
  onTutup: () => void
  tambahOffline: (p: Omit<Produk, 'id' | 'created_at' | 'updated_at'>) => Promise<{ message: string } | null>
}

async function lookupBarcode(barcode: string): Promise<Partial<ProdukScan> | null> {
  // 1) Katalog barcode ZPos sendiri (50 ribuan barcode, data global panel "Katalog").
  //    Pakai data ini dulu — konsisten dgn stok lokal; kalau ketemu tak perlu
  //    tanya server luar. Katalog tak punya foto (user isi/upload nanti).
  try {
    const res = await fetch(`/api/barcode-katalog/${encodeURIComponent(barcode)}`, { cache: 'no-store' })
    if (res.ok) {
      const d = await res.json()
      if (d?.nama) {
        return { nama: d.nama, kategori: d?.kategori || 'Umum' }
      }
    }
  } catch { /* offline → fallback ke Open Food Facts di bawah */ }

  // 2) Fallback: Open Food Facts (barcode EAN produk industri global).
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
    const data = await res.json()
    if (data.status !== 1) return null
    const p = data.product
    return {
      nama: p.product_name_id || p.product_name || p.brands || '',
      kategori: p.categories_tags?.[0]?.replace('en:', '').replace(/-/g, ' ') || 'Umum',
      foto_url: p.image_small_url || p.image_url || undefined,
    }
  } catch { return null }
}

export default function ScanBarcodeMassal({ onSelesai, onTutup, tambahOffline }: Props) {
  const { kategori: daftarKategori } = useKategori()
  const [produk, setProduk] = useState<ProdukScan[]>([])
  const [showKamera, setShowKamera] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)
  const [selesai, setSelesai] = useState(false)
  const [hasil, setHasil] = useState<{ berhasil: number; gagal: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [manualBarcode, setManualBarcode] = useState('')

  async function tambahBarcode(barcode: string) {
    const trimmed = barcode.trim()
    if (!trimmed) return
    if (produk.find(p => p.barcode === trimmed)) return // sudah ada

    const newItem: ProdukScan = {
      barcode: trimmed, nama: '', harga: 0, stok: 1,
      kategori: 'Umum', status: 'loading'
    }
    setProduk(prev => [newItem, ...prev])

    const info = await lookupBarcode(trimmed)
    setProduk(prev => prev.map(p => p.barcode === trimmed ? {
      ...p,
      nama: info?.nama || '',
      kategori: info?.kategori || 'Umum',
      foto_url: info?.foto_url,
      status: info?.nama ? 'found' : 'manual'
    } : p))
  }

  function hapus(barcode: string) {
    setProduk(prev => prev.filter(p => p.barcode !== barcode))
  }

  function update(barcode: string, field: keyof ProdukScan, value: ProdukScan[keyof ProdukScan]) {
    setProduk(prev => prev.map(p => p.barcode === barcode ? { ...p, [field]: value } : p))
  }

  async function simpanSemua() {
    const valid = produk.filter(p => p.nama.trim() && p.harga > 0)
    if (!valid.length) return
    setMenyimpan(true)
    try {
      const res = await fetch('/api/produk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produk: valid.map(p => ({
            nama: p.nama, harga: p.harga, stok: p.stok,
            kategori: p.kategori, barcode: p.barcode, foto_url: p.foto_url
          }))
        })
      })
      const data = await res.json()
      setHasil(data)
      setSelesai(true)
      if (data.berhasil > 0) onSelesai()
    } catch {
      // Endpoint bulk gagal total (kemungkinan besar offline) — antrikan
      // satu-satu, sama seperti ImportProduk.tsx. Kategori dari cache
      // lokal, default tanpa kategori kalau namanya belum pernah ada.
      let berhasil = 0
      for (const p of valid) {
        const kat = daftarKategori.find(k => k.nama.toLowerCase() === p.kategori.toLowerCase())
        const gagal = await tambahOffline({
          nama: p.nama, harga: p.harga, stok: p.stok, emoji: '📦', aktif: true,
          barcode: p.barcode, foto_url: p.foto_url, kategori_id: kat?.id ?? null,
        })
        if (!gagal) berhasil++
      }
      setHasil({ berhasil, gagal: valid.length - berhasil })
      setSelesai(true)
      if (berhasil > 0) onSelesai()
    }
    setMenyimpan(false)
  }

  const siapSimpan = produk.filter(p => p.nama.trim() && p.harga > 0).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <QrCodeScan size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-800">Scan Barcode Massal</span>
            {produk.length > 0 && (
              <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full">{produk.length}</span>
            )}
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100">
            <XLg size={16} className="text-gray-500" />
          </button>
        </div>

        {!selesai ? (
          <>
            {/* Scan area */}
            <div className="px-5 py-4 border-b border-gray-100 space-y-3">
              <button onClick={() => setShowKamera(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition">
                <QrCodeScan size={18} /> Scan Barcode dengan Kamera
              </button>
              <button onClick={() => inputRef.current?.focus()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-300 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition">
                <UpcScan size={18} /> Scan dengan Scanner USB
              </button>

              {/* Input manual */}
              <div className="flex gap-2">
                <input ref={inputRef} value={manualBarcode} data-scanner="barcode"
                  onChange={e => setManualBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { tambahBarcode(manualBarcode); setManualBarcode('') } }}
                  placeholder="Atau ketik barcode + Enter..."
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                <button onClick={() => { tambahBarcode(manualBarcode); setManualBarcode('') }}
                  disabled={!manualBarcode.trim()}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 disabled:opacity-40">
                  Tambah
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Nama & kategori otomatis dari katalog barcode ZPos, lalu Open Food Facts
              </p>
            </div>

            {/* Daftar produk */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {produk.length === 0 ? (
                <div className="py-10 text-center">
                  <Bag size={36} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">Belum ada produk di-scan</p>
                  <p className="text-xs text-gray-300 mt-1">Scan barcode produk untuk memulai</p>
                </div>
              ) : produk.map(p => (
                <div key={p.barcode} className={`rounded-xl border p-3 ${p.status === 'loading' ? 'border-gray-100 bg-gray-50' : p.nama && p.harga > 0 ? 'border-green-100 bg-green-50' : 'border-orange-100 bg-orange-50'}`}>
                  <div className="flex items-start gap-2">
                    {/* Foto */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center">
                      {p.foto_url
                        ? // eslint-disable-next-line @next/next/no-img-element -- foto URL eksternal/dinamis
                          <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
                        : <Box size={18} className="text-gray-300" />
                      }
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {p.status === 'loading' ? (
                        <div className="flex items-center gap-2">
                          <ArrowRepeat size={14} className="animate-spin text-gray-400" />
                          <span className="text-xs text-gray-400">Mencari info produk {p.barcode}...</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            {p.status === 'found' && <CheckLg size={12} className="text-green-500 flex-shrink-0" />}
                            {p.status === 'manual' && <ExclamationCircle size={12} className="text-orange-500 flex-shrink-0" />}
                            <span className="text-[10px] text-gray-400 font-mono">{p.barcode}</span>
                          </div>
                          <input value={p.nama} onChange={e => update(p.barcode, 'nama', e.target.value)}
                            placeholder="Nama produk *"
                            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400" />
                          <div className="flex gap-1.5">
                            <input type="number" value={p.harga || ''} onChange={e => update(p.barcode, 'harga', +e.target.value)}
                              placeholder="Harga *" inputMode="numeric"
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400" />
                            <input type="number" value={p.stok} onChange={e => update(p.barcode, 'stok', +e.target.value)}
                              placeholder="Stok" inputMode="numeric"
                              className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400" />
                            <input value={p.kategori} onChange={e => update(p.barcode, 'kategori', e.target.value)}
                              placeholder="Kategori"
                              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400" />
                          </div>
                        </>
                      )}
                    </div>

                    <button onClick={() => hapus(p.barcode)} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0">
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={simpanSemua} disabled={siapSimpan === 0 || menyimpan}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {menyimpan ? <><ArrowRepeat size={16} className="animate-spin" /> Menyimpan...</> : <>Simpan {siapSimpan} Produk</>}
              </button>
            </div>
          </>
        ) : (
          /* Selesai */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <CheckLg size={48} className="text-green-500 mb-3" />
            <p className="text-lg font-semibold text-gray-800 mb-1">Berhasil!</p>
            <p className="text-sm text-gray-500">{hasil?.berhasil} produk berhasil disimpan</p>
            {hasil?.gagal ? <p className="text-xs text-orange-500 mt-1">{hasil.gagal} produk dilewati</p> : null}
            <button onClick={onTutup} className="mt-5 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Selesai
            </button>
          </div>
        )}

        {showKamera && (
          <BarcodeCameraModal
            onScan={code => { setShowKamera(false); tambahBarcode(code) }}
            onTutup={() => setShowKamera(false)}
          />
        )}
      </div>
    </div>
  )
}
