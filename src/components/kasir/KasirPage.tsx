'use client'

import { useState, useMemo } from 'react'
import { Search, ShoppingCart, X } from 'lucide-react'
import { useProduk } from '@/hooks/useProduk'
import { useTransaksi } from '@/hooks/useTransaksi'
import { useKategori } from '@/hooks/useKategori'
import { useAuth } from '@/hooks/useAuth'
import { usePengaturan } from '@/hooks/usePengaturan'
import { ProdukGrid } from '@/components/kasir/ProdukGrid'
import { KeranjangPanel } from '@/components/kasir/KeranjangPanel'
import { StrukModal } from '@/components/kasir/StrukModal'
import { Produk, ItemKeranjang, Transaksi, DetailTransaksi } from '@/types'
import { hitungPajak, hitungTotal, noTrx } from '@/lib/utils'

export default function KasirPage() {
  const { produk, loading, kurangiStok, tambahStok } = useProduk()
  const { simpan } = useTransaksi()
  const { kategori } = useKategori()
  const { toko } = useAuth()
  const { pajakPersen } = usePengaturan()

  const [katId, setKatId] = useState<number | null>(null)
  const [cari, setCari] = useState('')
  const [keranjang, setKeranjang] = useState<Record<number, number>>({})
  const [diskon, setDiskon] = useState(0)
  const [bayar, setBayar] = useState('')
  const [metode, setMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai')
  const [struk, setStruk] = useState<Transaksi | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCart, setShowCart] = useState(false)

  const produkFiltered = useMemo(() =>
    produk.filter(p =>
      (katId === null || p.kategori_id === katId) &&
      p.nama.toLowerCase().includes(cari.toLowerCase())
    ), [produk, katId, cari])

  const items: ItemKeranjang[] = useMemo(() =>
    Object.entries(keranjang)
      .map(([id, qty]) => {
        const p = produk.find(x => x.id === Number(id))
        return p ? { ...p, qty } : null
      })
      .filter(Boolean) as ItemKeranjang[]
  , [keranjang, produk])

  const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0)
  const disc = Math.min(diskon, subtotal)
  const pajak = hitungPajak(subtotal, disc, pajakPersen)
  const total = hitungTotal(subtotal, disc, pajak)
  const kembali = Math.max((Number(bayar) || 0) - total, 0)
  const kurang = Math.max(total - (Number(bayar) || 0), 0)
  const totalItem = items.reduce((s, i) => s + i.qty, 0)

  const tambahKeKeranjang = (p: Produk) => {
    if (p.stok <= 0) return
    setKeranjang(k => ({ ...k, [p.id]: (k[p.id] || 0) + 1 }))
    kurangiStok(p.id, 1)
  }

  const ubahQty = (id: number, delta: number) => {
    const cur = keranjang[id] || 0
    const next = cur + delta
    if (next <= 0) {
      const { [id]: _, ...rest } = keranjang
      setKeranjang(rest)
      if (delta < 0) tambahStok(id, 1)
    } else {
      if (delta > 0) {
        const p = produk.find(x => x.id === id)
        if (!p || p.stok <= 0) return
        kurangiStok(id, 1)
      } else {
        tambahStok(id, 1)
      }
      setKeranjang(k => ({ ...k, [id]: next }))
    }
  }

  const bayarSekarang = async () => {
    if (items.length === 0 || (metode === 'Tunai' && kurang > 0)) return
    setSaving(true)

    const trxData: Transaksi = {
      no_transaksi: noTrx(),
      subtotal, diskon: disc, pajak, pajak_persen: pajakPersen, total,
      bayar: metode === 'Tunai' ? Number(bayar) : total,
      kembali: metode === 'Tunai' ? kembali : 0,
      metode_bayar: metode,
      kasir: toko?.userName ?? '',
      items: items.map(it => ({
        produk_id: it.id,
        nama_produk: it.nama,
        harga: it.harga,
        qty: it.qty,
        subtotal: it.harga * it.qty,
      })),
    }

    const details: DetailTransaksi[] = items.map(it => ({
      produk_id: it.id,
      nama_produk: it.nama,
      harga: it.harga,
      qty: it.qty,
      subtotal: it.harga * it.qty,
    }))

    await simpan(trxData, details)
    setStruk(trxData)
    setKeranjang({})
    setBayar('')
    setDiskon(0)
    setMetode('Tunai')
    setShowCart(false)
    setSaving(false)
  }

  const filterChips = (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button onClick={() => setKatId(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
          katId === null ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}>Semua</button>
      {kategori.map(k => (
        <button key={k.id} onClick={() => setKatId(k.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            katId === k.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}>{k.nama}</button>
      ))}
    </div>
  )

  const keranjangProps = {
    items, diskon: disc, bayar, metode,
    subtotal, pajak, pajakPersen, total, kembali, kurang,
    onUbahQty: ubahQty, onDiskon: setDiskon, onBayar: setBayar,
    onMetode: setMetode, onBayarSekarang: bayarSekarang,
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[1fr_310px] gap-4 p-4 h-[calc(100vh-56px)]">
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Cari produk..." className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          {filterChips}
          <div className="flex-1 overflow-y-auto">
            <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
          </div>
        </div>
        <KeranjangPanel {...keranjangProps} />
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col h-full p-3 gap-3">
        <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input value={cari} onChange={e => setCari(e.target.value)}
            placeholder="Cari produk..." className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        {filterChips}
        <div className="flex-1 overflow-y-auto">
          <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
        </div>
      </div>

      {/* Floating cart — mobile */}
      {!showCart && (
        <button onClick={() => setShowCart(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 bg-indigo-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
          <ShoppingCart size={22} />
          {totalItem > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {totalItem}
            </span>
          )}
        </button>
      )}

      {/* Cart drawer — mobile */}
      {showCart && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800">Keranjang</span>
              <button onClick={() => setShowCart(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <KeranjangPanel {...keranjangProps} />
            </div>
          </div>
        </div>
      )}

      <StrukModal transaksi={struk} onTutup={() => setStruk(null)} />
    </>
  )
}
