'use client'

import { useMemo, useState } from 'react'
import {
  BagPlusFill, Plus, Dash, Trash, Whatsapp,
} from 'react-bootstrap-icons'
import { formatPesanWa, waLink } from '@/lib/toko-online'

interface ProdukPublik {
  id: number
  nama: string
  harga: number
  emoji: string
  deskripsi?: string
  stok: number
  foto?: string | null
}

interface CartItem {
  id: number
  nama: string
  harga: number
  qty: number
}

const fmt = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID')

export function TokoOnlineClient({
  namaToko, waToko, produk,
}: { namaToko: string; waToko: string | null; produk: ProdukPublik[] }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<'katalog' | 'keranjang' | 'checkout'>('katalog')
  const [pemesan, setPemesan] = useState({ nama: '', alamat: '', catatan: '' })

  const total = useMemo(() => cart.reduce((s, i) => s + i.harga * i.qty, 0), [cart])

  const tambah = (p: ProdukPublik) => {
    setCart((c) => {
      const ada = c.find((i) => i.id === p.id)
      if (ada) return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
      return [...c, { id: p.id, nama: p.nama, harga: p.harga, qty: 1 }]
    })
  }
  const ubahQty = (id: number, delta: number) =>
    setCart((c) =>
      c
        .map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    )
  const hapus = (id: number) => setCart((c) => c.filter((i) => i.id !== id))

  const kirimWa = () => {
    if (!waToko || cart.length === 0) return
    const pesan = formatPesanWa(
      cart.map((i) => ({ nama: i.nama, qty: i.qty, harga: i.harga })),
      pemesan,
    )
    window.open(waLink(waToko, pesan), '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">{namaToko}</h1>
            <p className="text-xs text-gray-500">Katalog online — pesan via WhatsApp</p>
          </div>
          <button
            onClick={() => setView(cart.length ? 'keranjang' : 'katalog')}
            className="relative p-2 rounded-full hover:bg-gray-100 text-gray-600"
            aria-label="Keranjang"
          >
            <BagPlusFill size={22} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {view === 'katalog' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {produk.map((p) => {
              const habis = p.stok <= 0
              return (
                <div key={p.id} className={`bg-white rounded-xl p-3 border ${habis ? 'opacity-50' : ''}`}>
                  <div className="aspect-square w-full rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden mb-2">
                    {p.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.foto} alt={p.nama} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-4xl">{p.emoji}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 leading-tight line-clamp-2">{p.nama}</p>
                  <p className="text-emerald-600 font-semibold text-sm mt-1">{fmt(p.harga)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs ${habis ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {habis ? 'Habis' : `Stok ${p.stok}`}
                    </span>
                    <button
                      onClick={() => tambah(p)}
                      disabled={habis}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Tambah ${p.nama}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'keranjang' && (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Keranjang Anda</h2>
            {cart.length === 0 && <p className="text-sm text-gray-500">Keranjang kosong.</p>}
            {cart.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{i.nama}</p>
                  <p className="text-xs text-gray-500">{fmt(i.harga)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => ubahQty(i.id, -1)} className="p-1 rounded bg-gray-100 hover:bg-gray-200"><Dash size={14} /></button>
                  <span className="w-6 text-center text-sm">{i.qty}</span>
                  <button onClick={() => ubahQty(i.id, 1)} className="p-1 rounded bg-gray-100 hover:bg-gray-200"><Plus size={14} /></button>
                </div>
                <button onClick={() => hapus(i.id)} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash size={16} /></button>
              </div>
            ))}
            {cart.length > 0 && (
              <>
                <div className="text-right mt-3">
                  <span className="font-bold text-gray-800">Total: {fmt(total)}</span>
                </div>
                <button
                  className="w-full mt-3 bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  onClick={() => setView('checkout')}
                  disabled={!waToko}
                >
                  <Whatsapp size={18} className="inline me-2" />
                  Lanjut Pesan ({cart.reduce((s, i) => s + i.qty, 0)} item)
                </button>
                {!waToko && <p className="text-xs text-red-500 mt-2">Toko belum mengisi nomor WhatsApp pesanan.</p>}
              </>
            )}
          </div>
        )}

        {view === 'checkout' && (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Data Pemesan</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                kirimWa()
              }}
            >
              <label className="block text-sm text-gray-700 mb-1" htmlFor="pnama">Nama</label>
              <input
                id="pnama" required
                value={pemesan.nama}
                onChange={(e) => setPemesan((s) => ({ ...s, nama: e.target.value }))}
                placeholder="Nama lengkap"
                className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <label className="block text-sm text-gray-700 mb-1" htmlFor="palamat">Alamat (opsional)</label>
              <input
                id="palamat"
                value={pemesan.alamat}
                onChange={(e) => setPemesan((s) => ({ ...s, alamat: e.target.value }))}
                placeholder="Alamat pengiriman"
                className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <label className="block text-sm text-gray-700 mb-1" htmlFor="pcatatan">Catatan (opsional)</label>
              <textarea
                id="pcatatan" rows={2}
                value={pemesan.catatan}
                onChange={(e) => setPemesan((s) => ({ ...s, catatan: e.target.value }))}
                placeholder="Catatan tambahan"
                className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <button type="submit" className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700">
                <Whatsapp size={18} className="inline me-2" />
                Kirim via WhatsApp
              </button>
              <button
                type="button"
                className="w-full mt-1 text-sm text-gray-500 hover:text-gray-700 py-2"
                onClick={() => setView('keranjang')}
              >
                Kembali ke keranjang
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
