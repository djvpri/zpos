'use client'

import { useState, useRef } from 'react'
import { Produk } from '@/types'
import { useKategori } from '@/hooks/useKategori'
import { X, Camera, Trash2, Barcode, ScanLine, Image as ImageIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
const KameraModal = dynamic(() => import('./KameraModal'), { ssr: false })
const BarcodeCameraModal = dynamic(
  () => import('@/components/kasir/BarcodeScanner').then(m => m.BarcodeCameraModal),
  { ssr: false }
)

interface Props {
  produk?: Produk | null
  onSimpan: (p: Partial<Produk>) => void
  onTutup: () => void
}

function compressImage(file: File, maxSize = 400, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ProdukModal({ produk, onSimpan, onTutup }: Props) {
  const { kategori } = useKategori()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    nama: produk?.nama || '',
    harga: produk?.harga || '',
    stok: produk?.stok ?? '',
    deskripsi: produk?.deskripsi || '',
    foto_url: produk?.foto_url || '',
    barcode: produk?.barcode || '',
    kategori_id: produk?.kategori_id || '',
    expired_at: produk?.expired_at?.slice(0,10) || '',
    stok_minimum: produk?.stok_minimum ?? 5,
  })
  const [uploading, setUploading] = useState(false)
  const [scanBarcode, setScanBarcode] = useState(false)
  const [showKamera, setShowKamera] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const onFotoKamera = (base64: string) => {
    set('foto_url', base64)
  }

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const base64 = await compressImage(file)
      set('foto_url', base64)
    } catch {
      alert('Gagal memproses foto')
    }
    setUploading(false)
    e.target.value = ''
  }

  const submit = () => {
    if (!form.nama || !form.harga || !form.kategori_id) return
    onSimpan({
      ...(produk || {}),
      nama: form.nama,
      harga: Number(form.harga),
      stok: Number(form.stok) || 0,
      emoji: produk?.emoji || '📦',
      deskripsi: form.deskripsi.trim() || undefined,
      foto_url: form.foto_url || undefined,
      barcode: form.barcode.trim() || undefined,
      kategori_id: Number(form.kategori_id),
      expired_at: form.expired_at || undefined,
      stok_minimum: Number(form.stok_minimum) || 5,
      aktif: true,
    })
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 mt-1"

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base">{produk ? 'Edit Produk' : 'Tambah Produk'}</h3>
          <button onClick={onTutup} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          {/* Foto produk */}
          <div>
            <label className="text-xs text-gray-500">Foto Produk <span className="text-gray-300">(opsional)</span></label>
            <div className="mt-1">
              {form.foto_url ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={form.foto_url} alt="foto" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100"
                    >
                      <Camera size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => set('foto_url', '')}
                      className="p-2 bg-white rounded-lg text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors disabled:opacity-60"
                  >
                    <ImageIcon size={22} />
                    <span className="text-xs">{uploading ? 'Memproses...' : 'Galeri'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKamera(true)}
                    disabled={uploading}
                    className="flex-1 h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-purple-300 hover:text-purple-400 transition-colors disabled:opacity-60"
                  >
                    <Camera size={22} />
                    <span className="text-xs">Kamera</span>
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFoto} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFoto} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Nama Produk</label>
            <input className={inputCls} value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama produk" />
          </div>
          <div>
            <label className="text-xs text-gray-500 flex items-center gap-1">
              <Barcode size={12} /> Barcode <span className="text-gray-300">(opsional)</span>
            </label>
            <div className="flex gap-2 mt-1">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                value={form.barcode}
                onChange={e => set('barcode', e.target.value)}
                placeholder="Scan atau ketik barcode..."
                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
              />
              <button
                type="button"
                onClick={() => setScanBarcode(true)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                title="Scan dengan kamera"
              >
                <ScanLine size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Deskripsi <span className="text-gray-300">(opsional)</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.deskripsi}
              onChange={e => set('deskripsi', e.target.value)}
              placeholder="Deskripsi singkat produk..."
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Harga (Rp)</label>
              <input className={inputCls} type="number" value={form.harga} onChange={e => set('harga', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Stok</label>
              <input className={inputCls} type="number" value={form.stok} onChange={e => set('stok', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Kategori</label>
            <select className={inputCls} value={form.kategori_id} onChange={e => set('kategori_id', Number(e.target.value))}>
              <option value="">Pilih kategori</option>
              {kategori.map(k => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onTutup} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button onClick={submit} disabled={uploading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
            Simpan
          </button>
        </div>
      </div>
    </div>

      {scanBarcode && (
        <BarcodeCameraModal
          onScan={code => { set('barcode', code); setScanBarcode(false) }}
          onTutup={() => setScanBarcode(false)}
        />
      )}
      {showKamera && (
        <KameraModal onFoto={onFotoKamera} onClose={() => setShowKamera(false)} />
      )}
    </>
  )
}
