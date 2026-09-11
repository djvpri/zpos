'use client'

import { useState, useEffect } from 'react'
import { fmt } from '@/lib/utils'
import { Trash, PlusLg, ClockHistory } from 'react-bootstrap-icons'
import type { BonNota, BonGrup, BonItem } from '@/components/laporan/BonNotaModal'
import { idVirtualPreset } from '@/lib/bon-sesi'

// Satu baris item yang sedang diedit. `produk_id` 0 = baris baru (belum dipilih).
// `virtualNama` = nama item "Lainnya" (id negatif) supaya ikut terkirim di vmap.
interface BarisEdit { produk_id: number; nama: string; harga: number; qty: number }

// Edit isi bon PER GRUP. Setiap grup = satu kiriman barang dgn waktu & harganya
// sendiri, jadi qty/harga tiap grup bisa diubah terpisah (grup lama pun terbuka).
// Hasil dikirim sebagai `sesi` penuh (bentuk aditif: p = qty kiriman grup itu),
// supaya riwayat harga per grup dipertahankan apa adanya, bukan dilebur.
interface GrupEdit { t: string | null; baris: BarisEdit[] }

interface Produk { id: number; nama: string; harga: number }
// Preset = baris tabel item_virtual (id positif) → dipakai lewat id virtual negatif.
interface Preset { id: number; nama: string; harga: number }
// Satu hasil pencarian: produk katalog atau preset "Lainnya".
interface HasilCari { kunci: string; nama: string; harga: number; produkId: number; preset: boolean }

interface Props {
  nota: BonNota
  onSimpan: (
    produk: Record<number, number>,
    harga: Record<number, number>,
    total: number,
    vmap: Record<number, { nama: string; harga: number }>,
    sesi: { t: string; p: Record<string, number>; h: Record<string, number> }[],
  ) => Promise<void>
  onTutup: () => void
}

const waktuLabel = (t: string | null, i: number) =>
  t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : `Kiriman ${i + 1}`

export function BonEditModal({ nota, onSimpan, onTutup }: Props) {
  // Bentuk awal: pakai `grup` bila ada (harga per kiriman), else satu grup dari items.
  const [grup, setGrup] = useState<GrupEdit[]>(() => {
    if (nota.grup && nota.grup.length > 0) {
      return nota.grup.map((g: BonGrup) => ({
        t: g.waktu,
        baris: g.items.map((it: BonItem) => ({ produk_id: it.produk_id, nama: it.nama, harga: it.harga, qty: it.qty })),
      }))
    }
    return [{
      t: nota.created_at ?? null,
      baris: nota.items.map((it: BonItem) => ({ produk_id: it.produk_id, nama: it.nama, harga: it.harga, qty: it.qty })),
    }]
  })
  const [produk, setProduk] = useState<Produk[]>([])
  const [preset, setPreset] = useState<Preset[]>([])
  const [cari, setCari] = useState<{ gi: number; teks: string } | null>(null)
  const [err, setErr] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    // ?semua=1 = mode ringan (tanpa foto_thumb base64).
    fetch('/api/produk?semua=1').then(r => r.ok ? r.json() : []).then(setProduk).catch(() => setProduk([]))
    // Preset "Lainnya" (katalog item virtual per-toko) — tak punya stok/barcode,
    // jadi hanya ditawarkan di sini, bukan di daftar produk.
    fetch('/api/item-virtual').then(r => r.ok ? r.json() : []).then(setPreset).catch(() => setPreset([]))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => !e.repeat && e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  const ubahBaris = (gi: number, bi: number, patch: Partial<BarisEdit>) =>
    setGrup(gs => gs.map((g, i) => i !== gi ? g : { ...g, baris: g.baris.map((b, j) => j === bi ? { ...b, ...patch } : b) }))
  const buangBaris = (gi: number, bi: number) =>
    setGrup(gs => gs.map((g, i) => i !== gi ? g : { ...g, baris: g.baris.filter((_, j) => j !== bi) }))
  const tambahKe = (gi: number, p: HasilCari) => {
    setCari(null)
    setGrup(gs => gs.map((g, i) => {
      if (i !== gi) return g
      // Produk sudah ada DI GRUP INI → naikkan qty, bukan baris kembar.
      const bi = g.baris.findIndex(b => b.produk_id === p.produkId)
      if (bi >= 0) return { ...g, baris: g.baris.map((b, j) => j === bi ? { ...b, qty: b.qty + 1 } : b) }
      return { ...g, baris: [...g.baris, { produk_id: p.produkId, nama: p.nama, harga: p.harga, qty: 1 }] }
    }))
  }
  const buangGrup = (gi: number) => setGrup(gs => gs.filter((_, i) => i !== gi))

  const total = grup.reduce((s, g) => s + g.baris.reduce((a, b) => a + Math.round(b.harga * b.qty), 0), 0)
  // Gabungan produk katalog + preset "Lainnya" dalam satu daftar: produk dulu
  // (dipakai paling sering), lalu preset yg cocok. Preset dikirim dgn id virtual
  // negatif (idVirtualPreset) supaya tidak bentrok dgn produk asli.
  const hasilCari: HasilCari[] = (() => {
    const q = cari?.teks.trim().toLowerCase()
    if (!q) return []
    const dariProduk: HasilCari[] = produk
      .filter(p => p.nama.toLowerCase().includes(q))
      .slice(0, 8)
      .map(p => ({ kunci: `p${p.id}`, nama: p.nama, harga: p.harga, produkId: p.id, preset: false }))
    const sisa = Math.max(0, 8 - dariProduk.length)
    const dariPreset: HasilCari[] = sisa === 0 ? [] : preset
      .filter(p => p.nama.toLowerCase().includes(q))
      .slice(0, sisa)
      .map(p => ({ kunci: `v${p.id}`, nama: p.nama, harga: p.harga, produkId: idVirtualPreset(p.id), preset: true }))
    return [...dariProduk, ...dariPreset]
  })()

  const simpanKe = async () => {
    // Item virtual (id negatif, "Lainnya") ikut dipertahankan.
    const bersih = grup
      .map(g => ({ t: g.t, baris: g.baris.filter(b => b.produk_id !== 0 && b.qty > 0) }))
      .filter(g => g.baris.length > 0)
    if (!bersih.length) { setErr('Bon harus punya minimal 1 grup berisi barang'); return }
    if (!bersih.some(g => g.baris.some(b => b.produk_id > 0))) { setErr('Bon harus punya minimal 1 produk'); return }

    const produkObj: Record<number, number> = {}
    const hargaObj: Record<number, number> = {}
    const vmapObj: Record<number, { nama: string; harga: number }> = {}
    for (const g of bersih) {
      for (const b of g.baris) {
        produkObj[b.produk_id] = (produkObj[b.produk_id] ?? 0) + b.qty
        hargaObj[b.produk_id] = b.harga
        if (b.produk_id < 0) vmapObj[b.produk_id] = { nama: b.nama, harga: b.harga }
      }
    }
    // `sesi` = bentuk ADITIF: tiap grup kirim qty-nya sendiri + harga saat itu.
    const sesi = bersih.map(g => ({
      t: g.t ?? new Date().toISOString(),
      p: Object.fromEntries(g.baris.map(b => [String(b.produk_id), b.qty])),
      h: Object.fromEntries(g.baris.map(b => [String(b.produk_id), Math.round(b.harga)])),
    }))

    setErr(''); setSimpan(true)
    try {
      await onSimpan(produkObj, hargaObj, total, vmapObj, sesi)
      onTutup()
    } catch (e) { setErr((e as Error).message) } finally { setSimpan(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex overflow-y-auto z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onTutup() }}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl m-auto p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Edit Bon Gantung #{nota.id}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Tiap grup = satu kiriman barang dgn harga saat itu. Ubah jumlah/harga di grup mana pun, atau buang grupnya.
          </p>
        </div>

        {/* Daftar grup */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {grup.map((g, gi) => (
            <div key={gi} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <ClockHistory size={13} /> Grup {gi + 1} — {waktuLabel(g.t, gi)}
                </span>
                <button onClick={() => buangGrup(gi)} title="Buang grup ini"
                  className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                  <Trash size={13} />
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {g.baris.length === 0 && <div className="py-2 text-xs text-gray-300">Belum ada item</div>}
                {g.baris.map((b, bi) => (
                  <div key={bi} className="flex items-center gap-2 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{b.nama}</div>
                      <div className="text-xs text-gray-400">{fmt(Math.round(b.harga * b.qty))}</div>
                    </div>
                    <input type="number" min={0} value={b.qty}
                      onChange={e => ubahBaris(gi, bi, { qty: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-16 px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input type="number" min={0} value={b.harga}
                      onChange={e => ubahBaris(gi, bi, { harga: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-24 px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={() => buangBaris(gi, bi)} title="Buang item"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Tambah item ke grup ini */}
              <div className="relative mt-2">
                <div className="flex items-center gap-2">
                  <input value={cari?.gi === gi ? cari.teks : ''}
                    onChange={e => setCari({ gi, teks: e.target.value })}
                    placeholder={`Tambah produk / preset ke grup ${gi + 1}...`}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <PlusLg size={15} className="text-gray-300" />
                </div>
                {cari?.gi === gi && hasilCari.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {hasilCari.map(p => (
                      <button key={p.kunci} onClick={() => tambahKe(gi, p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors">
                        <span className="text-gray-800">{p.nama}</span>
                        {p.preset && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-2">Preset</span>}
                        <span className="text-xs text-gray-400 ml-2">{fmt(p.harga)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end text-xs text-gray-500 mt-2">
                Subtotal grup: {fmt(g.baris.reduce((a, b) => a + Math.round(b.harga * b.qty), 0))}
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setGrup(gs => [...gs, { t: new Date().toISOString(), baris: [] }])}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors">
          <PlusLg size={14} /> Tambah grup kiriman baru
        </button>

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
