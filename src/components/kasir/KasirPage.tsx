'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useProduk } from '@/hooks/useProduk'
import { useTransaksi } from '@/hooks/useTransaksi'
import { ProdukGrid } from '@/components/kasir/ProdukGrid'
import { KeranjangPanel } from '@/components/kasir/KeranjangPanel'
import { StrukModal } from '@/components/kasir/StrukModal'
import { Produk, ItemKeranjang, Transaksi, DetailTransaksi } from '@/types'
import { hitungPajak, hitungTotal, noTrx } from '@/lib/utils'

const KATEGORI = ['Semua', 'Makanan', 'Minuman', 'Snack', 'Lainnya']

export default function KasirPage() {
  const { produk, loading, kurangiStok, tambahStok } = useProduk()
  const { simpan } = useTransaksi()

  const [kat, setKat] = useState('Semua')
  const [cari, setCari] = useState('')
  const [keranjang, setKeranjang] = useState<Record<number, number>>({})
  const [diskon, setDiskon] = useState(0)
  const [bayar, setBayar] = useState('')
  const [metode, setMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai')
  const [struk, setStruk] = useState<Transaksi | null>(null)
  const [saving, setSaving] = useState(false)

  const produkFiltered = useMemo(() =>
    produk.filter(p =>
      (kat === 'Semua' || (p.kategori as any)?.nama === kat || p.kategori_id === KATEGORI.indexOf(kat)) &&
      p.nama.toLowerCase().includes(cari.toLowerCase())
    ), [produk, kat, cari])

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
  const pajak = hitungPajak(subtotal, disc)
  const total = hitungTotal(subtotal, disc, pajak)
  const kembali = Math.max((Number(bayar) || 0) - total, 0)
  const kurang = Math.max(total - (Number(bayar) || 0), 0)

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
      subtotal, diskon: disc, pajak, total,
      bayar: metode === 'Tunai' ? Number(bayar) : total,
      kembali: metode === 'Tunai' ? kembali : 0,
      metode_bayar: metode,
      kasir: 'Kasir 1',
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
    setSaving(false)
  }

  return (
    <div className="grid grid-cols-[1fr_310px] gap-4 p-4 h-[calc(100vh-56px)]">
      {/* Kiri */}
      <div className="flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={cari} onChange={e => setCari(e.target.value)}
            placeholder="Cari produk..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {KATEGORI.map(k => (
            <button key={k} onClick={() => setKat(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                kat === k ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >{k}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
        </div>
      </div>

      {/* Kanan */}
      <KeranjangPanel
        items={items} diskon={disc} bayar={bayar} metode={metode}
        subtotal={subtotal} pajak={pajak} total={total} kembali={kembali} kurang={kurang}
        onUbahQty={ubahQty} onDiskon={setDiskon} onBayar={setBayar}
        onMetode={setMetode} onBayarSekarang={bayarSekarang}
      />

      <StrukModal transaksi={struk} onTutup={() => setStruk(null)} />
    </div>
  )
}
