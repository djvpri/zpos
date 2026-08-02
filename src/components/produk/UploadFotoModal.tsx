'use client'

import { useState, useRef, useEffect } from 'react'
import { XLg, CameraFill, CheckCircleFill, XCircleFill, HourglassSplit, CloudArrowUp } from 'react-bootstrap-icons'
import { compressImage } from '@/lib/compress-image'

interface ItemAntrian {
  id: string
  file: File
  preview: string          // base64 terkecil utk tampil
  status: 'menunggu' | 'dikompres' | 'diproses' | 'sukses' | 'gagal'
  nama?: string
  alasan?: string
  barcode?: string
}

// Upload banyak foto → tiap foto jadi 1 produk. File dikompres dulu (≤400px),
// lalu diproses ANTRIAN satu-per-satu oleh server (endpoint /api/produk/batch-foto)
// yang men-detect nama+kategori via Gemini lalu menyimpan produk mode cepat
// (harga 1, stok 0). Progress per foto biar user tahu mana yang sukses/gagal.
export default function UploadFotoModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ItemAntrian[]>([])
  const [running, setRunning] = useState(false)
  const [selesai, setSelesai] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // Ref barang-antrian yg SELALU mutakhir — hindari stale closure & race pada
  // auto-start (useEffect). Loop baca versi terbaru, bukan snapshot render.
  const itemsRef = useRef<ItemAntrian[]>([])
  itemsRef.current = items

  const update = (id: string, patch: Partial<ItemAntrian>) => {
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
  }

  // Auto-proses: begitu ada foto baru & running=true, jalankan loop antrian.
  // useEffect mengatasi state async — `mulai` tak perlu dipanggil dari handler.
  useEffect(() => {
    if (!running) return
    ;(async () => {
      // loop sampai tak ada item 'menunggu'/'dikompres'/'diproses' tersisa
      for (;;) {
        const antri = itemsRef.current
        const next = antri.find(i => i.status === 'menunggu' || i.status === 'dikompres')
        if (!next) break
        await prosesSatu(next)
      }
      setRunning(false)
      setSelesai(true)
    })()
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const tambahFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const baru: ItemAntrian[] = []
    for (const f of Array.from(files).slice(0, 50)) {
      let preview = ''
      try { preview = await compressImage(f, 160, 0.6) } catch { /* diabaikan */ }
      baru.push({ id: `${Date.now()}-${Math.random()}`, file: f, preview, status: 'menunggu' })
    }
    setItems(prev => [...prev, ...baru])
    // auto-start antrian — jika belum berjalan, mulai sekarang
    setSelesai(false)
    setRunning(r => r || true)
  }

  // Proses antrian: 1-per-1 (konkurensi 1) — request kecil, stabil rate-limit Gemini
  const prosesSatu = async (item: ItemAntrian) => {
    update(item.id, { status: 'dikompres' })
    let foto: string
    try {
      foto = await compressImage(item.file, 400, 0.75)
    } catch {
      update(item.id, { status: 'gagal', alasan: 'Kompresi gagal' })
      return
    }
    update(item.id, { status: 'diproses' })
    try {
      const res = await fetch('/api/produk/batch-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) {
        update(item.id, { status: 'sukses', nama: d.nama, barcode: d.barcode })
      } else {
        const alasan = d?.alasan === 'nama_tidak_terdeteksi'
          ? 'Nama tidak terdeteksi'
          : d?.error || d?.alasan || `Gagal (${res.status})`
        update(item.id, { status: 'gagal', alasan })
      }
    } catch {
      update(item.id, { status: 'gagal', alasan: 'Jaringan' })
    }
  }

  // Handler klik manual — tetap dipakai tombol 'Proses N foto'
  const mulai = () => {
    if (running) return
    setSelesai(false)
    setRunning(true)
  }

  const sukses = items.filter(i => i.status === 'sukses').length
  const gagal = items.filter(i => i.status === 'gagal').length
  const diproses = items.filter(i => i.status === 'diproses').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CameraFill size={16} className="text-indigo-600" />
              Upload Foto Produk
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {items.length} foto · {sukses} sukses · {gagal} gagal
              {diproses > 0 && ` · memproses...`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><XLg size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { tambahFile(e.target.files); e.target.value = '' }}
          />

          {items.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-10 flex flex-col items-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
            >
              <CloudArrowUp size={28} />
              <span className="text-sm font-medium">Pilih banyak foto (maks 50)</span>
              <span className="text-xs">Tiap foto akan jadi 1 produk · harga Rp1 · update via Excel nanti</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-sm font-medium py-2.5 hover:bg-indigo-100 transition-colors"
              >
                + Tambah foto lagi
              </button>

              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  {item.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview data URI dinamis
                    <img src={item.preview} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.nama || item.file.name}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {item.status === 'sukses' && item.barcode && `Barcode ${item.barcode}`}
                      {item.status === 'gagal' && (item.alasan || 'Gagal')}
                      {item.status === 'diproses' && 'Mendeteksi nama + menyimpan...'}
                      {item.status === 'menunggu' && 'Antrean'}
                    </div>
                  </div>
                  <span className="shrink-0">
                    {item.status === 'sukses' && <CheckCircleFill className="text-green-500" size={20} />}
                    {item.status === 'gagal' && <XCircleFill className="text-red-400" size={20} />}
                    {item.status === 'diproses' && <HourglassSplit className="text-indigo-400 animate-pulse" size={20} />}
                    {item.status === 'menunggu' && <HourglassSplit className="text-gray-300" size={20} />}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={mulai}
            disabled={running || items.length === 0 || selesai}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {selesai
              ? `Selesai (${sukses} sukses, ${gagal} gagal)`
              : running ? 'Memproses...' : `Proses ${items.length} foto`}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
