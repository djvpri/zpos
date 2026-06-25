'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, ShoppingCart, X, ScanLine, MoreHorizontal, Camera } from 'lucide-react'
import PenjualanLain from '@/components/kasir/PenjualanLain'
import { useProduk } from '@/hooks/useProduk'
import { useTransaksi } from '@/hooks/useTransaksi'
import { useKategori } from '@/hooks/useKategori'
import { useAuth } from '@/hooks/useAuth'
import { usePengaturan } from '@/hooks/usePengaturan'
import { ProdukGrid } from '@/components/kasir/ProdukGrid'
import { KeranjangPanel } from '@/components/kasir/KeranjangPanel'
import { StrukModal } from '@/components/kasir/StrukModal'
import { ShiftBanner } from '@/components/kasir/ShiftBanner'
import dynamic from 'next/dynamic'
import { useBarcodeUsbListener } from '@/components/kasir/BarcodeScanner'
const ScanProdukVisual = dynamic(() => import('@/components/kasir/ScanProdukVisual'), { ssr: false })
const BarcodeCameraModal = dynamic(
  () => import('@/components/kasir/BarcodeScanner').then(m => m.BarcodeCameraModal),
  { ssr: false }
)
import { Produk, ItemKeranjang, Transaksi, DetailTransaksi } from '@/types'
import { hitungPajak, hitungTotal, noTrx } from '@/lib/utils'

export default function KasirPage() {
  const { produk, loading, kurangiStok, tambahStok } = useProduk()
  const { simpan } = useTransaksi()
  const { kategori } = useKategori()
  const { toko } = useAuth()
  const { pajakPersen, alamat, telepon, catatan_struk } = usePengaturan()

  const [katId, setKatId] = useState<number | null>(null)
  const [cari, setCari] = useState('')
  const [keranjang, setKeranjang] = useState<Record<number, number>>({})
  const [diskon, setDiskon] = useState(0)
  const [bayar, setBayar] = useState('')
  const [metode, setMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai')
  const [struk, setStruk] = useState<Transaksi | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [tab, setTab] = useState<'produk' | 'lain'>('produk')
  const [showScanVisual, setShowScanVisual] = useState(false)
  const [virtualProduk, setVirtualProduk] = useState<Record<number, {id:number;nama:string;harga:number;stok:number;kategori_id:null;barcode:null;foto_url:null}>>({}) 

  const produkFiltered = useMemo(() =>
    produk.filter(p =>
      (katId === null || p.kategori_id === katId) &&
      p.nama.toLowerCase().includes(cari.toLowerCase())
    ), [produk, katId, cari])

  const items: ItemKeranjang[] = useMemo(() =>
    Object.entries(keranjang)
      .map(([id, qty]) => {
        const numId = Number(id)
        const p = numId < 0
          ? virtualProduk[numId]
          : produk.find(x => x.id === numId)
        return p ? { ...p, qty } : null
      })
      .filter(Boolean) as ItemKeranjang[]
  , [keranjang, produk, virtualProduk])

  const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0)
  const disc = Math.min(diskon, subtotal)
  const pajak = hitungPajak(subtotal, disc, pajakPersen)
  const total = hitungTotal(subtotal, disc, pajak)
  const kembali = Math.max((Number(bayar) || 0) - total, 0)
  const kurang = Math.max(total - (Number(bayar) || 0), 0)
  const totalItem = items.reduce((s, i) => s + i.qty, 0)

  function pilihDariVisualScan(produkId: number, nama: string, harga: number) {
    const p = produk.find(x => x.id === produkId)
    if (p) {
      tambahKeKeranjang(p)
    } else {
      // Produk tidak ada di cache lokal, tambah sebagai virtual
      const virtualId = -produkId
      setVirtualProduk(v => ({ ...v, [virtualId]: { id: virtualId, nama, harga, stok: 9999, kategori_id: null, barcode: null, foto_url: null } }))
      setKeranjang(k => ({ ...k, [virtualId]: (k[virtualId] || 0) + 1 }))
    }
  }

  function tambahItemLain(itemsLain: {id: string; nama: string; harga: number; qty: number}[]) {
    const newVirtual: Record<number, any> = {}
    const newKeranjang: Record<number, number> = {}
    itemsLain.forEach(item => {
      const virtualId = -(Date.now() + Math.floor(Math.random() * 10000))
      newVirtual[virtualId] = { id: virtualId, nama: item.nama, harga: item.harga, stok: 9999, kategori_id: null, barcode: null, foto_url: null }
      newKeranjang[virtualId] = item.qty
    })
    setVirtualProduk(v => ({ ...v, ...newVirtual }))
    setKeranjang(k => ({ ...k, ...newKeranjang }))
  }

  const tambahKeKeranjang = (p: Produk) => {
    if (p.stok <= 0) return
    setKeranjang(k => ({ ...k, [p.id]: (k[p.id] || 0) + 1 }))
    kurangiStok(p.id, 1)
  }

  const onBarcodeScan = useCallback(async (code: string) => {
    const res = await fetch(`/api/produk/barcode/${encodeURIComponent(code)}`)
    if (!res.ok) return
    const p = await res.json()
    tambahKeKeranjang(p)
  }, [produk])

  useBarcodeUsbListener(onBarcodeScan)

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
    setVirtualProduk({})
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
      <ShiftBanner />

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[1fr_310px] gap-4 p-4 h-[calc(100vh-56px)]">
        <div className="flex flex-col gap-3 overflow-hidden">
          {/* Tab Produk / Lainnya */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            <button onClick={() => setTab('produk')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'produk' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              Produk
            </button>
            <button onClick={() => setTab('lain')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'lain' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              <MoreHorizontal size={14} className="inline mr-1" />Lainnya
            </button>
          </div>

          {tab === 'produk' ? (
            <>
              <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input value={cari} onChange={e => setCari(e.target.value)}
                  placeholder="Cari produk atau barcode..." className="flex-1 bg-transparent outline-none text-sm" />
                <button onClick={() => setShowCamera(true)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Scan barcode kamera">
                  <ScanLine size={18} />
                </button>
              </div>
              {filterChips}
              <div className="flex-1 overflow-y-auto">
                <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <PenjualanLain onTambahKeKeranjang={tambahItemLain} />
            </div>
          )}
        </div>
        <KeranjangPanel {...keranjangProps} />
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col h-full p-3 gap-3">
        <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input value={cari} onChange={e => setCari(e.target.value)}
            placeholder="Cari produk..." className="flex-1 bg-transparent outline-none text-sm" />
          <button onClick={() => setShowCamera(true)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors">
            <ScanLine size={18} />
          </button>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          <button onClick={() => setTab('produk')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'produk' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            Produk
          </button>
          <button onClick={() => setTab('lain')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'lain' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            Lainnya
          </button>
        </div>
        {tab === 'produk' ? (
          <>
            {filterChips}
            <div className="flex-1 overflow-y-auto">
              <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <PenjualanLain onTambahKeKeranjang={tambahItemLain} />
          </div>
        )}
      </div>

      {/* Floating cart — mobile */}
      {!showCart && (
        <button onClick={() => setShowCart(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 bg-indigo-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
          <ShoppingCart size={22} />
          {totalItem > 0 && (
            <span data-testid="cart-count" className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
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

      {showCamera && (
        <BarcodeCameraModal onScan={onBarcodeScan} onTutup={() => setShowCamera(false)} />
      )}
      <StrukModal
        transaksi={struk}
        toko={{ nama: toko?.nama ?? '', alamat, telepon, catatan_struk }}
        onTutup={() => setStruk(null)}
      />
    </>
  )
}
