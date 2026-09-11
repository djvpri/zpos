'use client'

import { useState, useEffect } from 'react'
import { fmt } from '@/lib/utils'
import { Trash, PlusLg } from 'react-bootstrap-icons'
import type { BonNota } from '@/components/laporan/BonNotaModal'

// Satu baris item yang sedang diedit. `produk_id` 0 = baris baru (belum dipilih).
interface BarisEdit { produk_id: number; nama: string; harga: number; qty: number }

interface Produk { id: number; nama: string; harga: number }

interface Props {
  nota: BonNota
  onSimpan: (produk: Record<number, number>, harga: Record<number, number>, total: number, vmap?: Record<number, { nama: string; harga: number }>) => Promise<void>
  onTutup: () => void
}

// Edit isi + harga bon gantung. Patch ke PATCH /api/bon/{id} (produk + harga),
// server hitung ulang sesi & hold stok. Baris qty 0 = item dibuang.
export function BonEditModal({ nota, onSimpan, onTutup }: Props) {
  const [baris, setBaris] = useState<BarisEdit[]>(
    nota.items.map(it => ({ produk_id: it.produk_id, nama: it.nama, harga: it.harga, qty: it.qty }))
  )
  const [produk, setProduk] = useState<Produk[]>([])
  const [cari, setCari] = useState('')
  const [err, setErr] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    // ?semua=1 = mode ringan (tanpa foto_thumb base64). Web normal ikut kirim
    // thumbnail → payload puluhan MB utk ribuan produk, tak perlu di sini.
    fetch('/api/produk?semua=1').then(r => r.ok ? r.json() : []).then(setProduk).catch(() => setProduk([]))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => !e.repeat && e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  const ubah = (i: number, patch: Partial<BarisEdit>) =>
    setBaris(bs => bs.map((b, j) => j === i ? { ...b, ...patch } : b))
  const buang = (i: number) => setBaris(bs => bs.filter((_, j) => j !== i))
  const tambah = (p: Produk) => {
    setCari('')
    setBaris(bs => {
      // Produk sudah ada di daftar → naikkan qty-nya, bukan bikin baris kembar.
      const i = bs.findIndex(b => b.produk_id === p.id)
      if (i >= 0) return bs.map((b, j) => j === i ? { ...b, qty: b.qty + 1 } : b)
      return [...bs, { produk_id: p.id, nama: p.nama, harga: p.harga, qty: 1 }]
    })
  }

  const total = baris.reduce((s, b) => s + Math.round(b.harga * b.qty), 0)
  const hasilCari = cari.trim()
    ? produk.filter(p => p.nama.toLowerCase().includes(cari.trim().toLowerCase())).slice(0, 8)
    : []

  const simpanKe = async () => {
    // Item virtual (id negatif, "Lainnya") ikut dipertahankan — kalau dibuang di
    // sini, barisnya HILANG dari bon diam-diam & total web jadi selisih.
    const valid = baris.filter(b => b.produk_id !== 0 && b.qty > 0)
    if (!valid.some(b => b.produk_id > 0)) { setErr('Bon harus punya minimal 1 produk'); return }
    const produkObj: Record<number, number> = {}
    const hargaObj: Record<number, number> = {}
    const vmapObj: Record<number, { nama: string; harga: number }> = {}
    for (const b of valid) {
      produkObj[b.produk_id] = b.qty; hargaObj[b.produk_id] = b.harga
      if (b.produk_id < 0) vmapObj[b.produk_id] = { nama: b.nama, harga: b.harga }
    }
    setErr(''); setSimpan(true)
    try {
      await onSimpan(produkObj, hargaObj, valid.reduce((s, b) => s + Math.round(b.harga * b.qty), 0), vmapObj)
      onTutup()
    } catch (e) { setErr((e as Error).message) } finally { setSimpan(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex overflow-y-auto z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onTutup() }}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl m-auto p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Edit Bon Gantung #{nota.id}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Ubah jumlah, harga, atau buang item. Isi selain harga bon baku masih bisa diubah nanti.
          </p>
        </div>

        {/* Daftar item */}
        <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {baris.length === 0 && <div className="p-4 text-center text-sm text-gray-300">Belum ada item</div>}
          {baris.map((b, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800 truncate">{b.nama}</div>
                <div className="text-xs text-gray-400">{fmt(Math.round(b.harga * b.qty))}</div>
              </div>
              <input type="number" min={0} value={b.qty}
                onChange={e => ubah(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <input type="number" min={0} value={b.harga}
                onChange={e => ubah(i, { harga: Math.max(0, Number(e.target.value) || 0) })}
                className="w-24 px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button onClick={() => buang(i)} title="Buang item"
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Tambah item */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <input value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Cari produk untuk ditambah..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <PlusLg size={16} className="text-gray-300" />
          </div>
          {hasilCari.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {hasilCari.map(p => (
                <button key={p.id} onClick={() => tambah(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors">
                  <span className="text-gray-800">{p.nama}</span>
                  <span className="text-xs text-gray-400 ml-2">{fmt(p.harga)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-gray-100 pt-3">
          <span className="text-sm font-semibold text-gray-700">TOTAL</span>
          <span className="text-base font-bold text-gray-900">{fmt(total)}</span>
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onTutup}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            Batal
          </button>
          <button onClick={simpanKe} disabled={simpan}
            className="flex-1 py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors disabled:opacity-60">
            {simpan ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
