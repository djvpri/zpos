'use client'

import { useMemo, useState } from 'react'
import {
  BagPlusFill, Plus, Dash, Trash, Whatsapp, X, Search,
  ArrowLeft, PersonCircle, GeoAlt, House, BagCheck,
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
  kategori?: string
}

interface CartItem {
  id: number
  nama: string
  harga: number
  qty: number
  foto?: string | null
  emoji: string
}

const fmt = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID')

export function TokoOnlineClient({
  namaToko, waToko, produk, kategori,
}: {
  namaToko: string
  waToko: string | null
  produk: ProdukPublik[]
  kategori: string[]
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<'katalog' | 'keranjang' | 'checkout'>('katalog')
  const [katAktif, setKatAktif] = useState<string>('Semua')
  const [cari, setCari] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [pemesan, setPemesan] = useState({ nama: '', alamat: '', catatan: '' })

  const total = useMemo(() => cart.reduce((s, i) => s + i.harga * i.qty, 0), [cart])
  const totalItem = cart.reduce((s, i) => s + i.qty, 0)

  const detail = produk.find((p) => p.id === detailId) ?? null

  const daftarFilter = useMemo(() => {
    let list = cari.trim()
      ? produk.filter((p) => p.nama.toLowerCase().includes(cari.toLowerCase()))
      : produk
    if (katAktif !== 'Semua') list = list.filter((p) => p.kategori === katAktif)
    return list
  }, [produk, katAktif, cari])

  const tambah = (p: ProdukPublik, qty = 1) => {
    setCart((c) => {
      const ada = c.find((i) => i.id === p.id)
      if (ada) return c.map((i) => (i.id === p.id ? { ...i, qty: Math.min(i.qty + qty, p.stok) } : i))
      return [...c, { id: p.id, nama: p.nama, harga: p.harga, qty, foto: p.foto, emoji: p.emoji }]
    })
  }
  const ubahQty = (id: number, delta: number, maxStok: number) =>
    setCart((c) =>
      c
        .map((i) => (i.id === id ? { ...i, qty: Math.min(Math.max(1, i.qty + delta), maxStok) } : i))
        .filter((i) => i.qty > 0),
    )
  const hapus = (id: number) => setCart((c) => c.filter((i) => i.id !== id))

  const kirimWa = () => {
    if (!waToko || cart.length === 0) return
    const pesan = formatPesanWa(cart.map((i) => ({ nama: i.nama, qty: i.qty, harga: i.harga })), pemesan)
    window.open(waLink(waToko, pesan), '_blank')
  }

  const terbuka = produk.some((p) => p.stok > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== Header brand ===== */}
      <header className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-14">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl shadow-inner">
              <House size={28} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold leading-tight drop-shadow-sm">{namaToko}</h1>
              <p className="text-sm text-white/85">Belanja mudah — pesan langsung via WhatsApp</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${terbuka ? 'bg-lime-300 animate-pulse' : 'bg-white/50'}`} />
              {terbuka ? 'Sedang Buka' : 'Stok Habis'}
            </span>
            {waToko && (
              <a
                href={waLink(waToko, `Halo ${namaToko}, saya mau tanya produk.`)}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition"
              >
                <Whatsapp size={15} /> Chat
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-8 pb-32">
        {/* ===== Search + kategori ===== */}
        <div className="bg-white shadow-sm rounded-2xl p-3 ring-1 ring-black/5">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
            <Search className="text-gray-400" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari produk..."
              className="flex-1 bg-transparent focus:outline-none text-sm"
            />
            {cari && (
              <button onClick={() => setCari('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            )}
          </div>
          {kategori.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-3 pb-1 snap-x">
              {['Semua', ...kategori].map((k) => (
                <button
                  key={k}
                  onClick={() => setKatAktif(k)}
                  className={`snap-start shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition ${
                    katAktif === k
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== Grid produk ===== */}
        {view === 'katalog' && (
          <>
            {daftarFilter.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <BagCheck size={40} className="mx-auto mb-3" />
                <p className="font-medium text-gray-500">Tidak ada produk</p>
                <p className="text-sm">Belum ada produk di kategori ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {daftarFilter.map((p) => {
                  const habis = p.stok <= 0
                  return (
                    <button
                      key={p.id}
                      onClick={() => setDetailId(p.id)}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left ${habis ? 'opacity-80' : ''}`}
                    >
                      <div className="aspect-square w-full bg-gray-100 flex items-center justify-center overflow-hidden relative">
                        {p.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.foto} alt={p.nama} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-5xl">{p.emoji}</span>
                        )}
                        {habis && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            HABIS
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold leading-tight text-gray-800 line-clamp-2">{p.nama}</p>
                        {p.kategori && <p className="text-[10px] text-gray-400 mt-0.5">{p.kategori}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-emerald-600 font-bold text-sm">{fmt(p.harga)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!habis) tambah(p) }}
                            disabled={habis}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Tambah ${p.nama}`}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ===== Keranjang ===== */}
        {view === 'keranjang' && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 mt-4">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setView('katalog')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
              <h2 className="font-bold text-gray-800 flex-1">Keranjang Anda</h2>
              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">{totalItem} item</span>
            </div>
            {cart.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Keranjang kosong.</p>}
            {cart.map((i) => {
              const maxStok = produk.find((p) => p.id === i.id)?.stok ?? 99
              return (
                <div key={i.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {i.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.foto} alt={i.nama} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">{i.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{i.nama}</p>
                    <p className="text-xs text-gray-500">{fmt(i.harga)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => ubahQty(i.id, -1, maxStok)} className="p-1 rounded bg-gray-100 hover:bg-gray-200"><Dash size={14} /></button>
                    <span className="w-6 text-center text-sm font-medium">{i.qty}</span>
                    <button onClick={() => ubahQty(i.id, 1, maxStok)} className="p-1 rounded bg-gray-100 hover:bg-gray-200"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => hapus(i.id)} className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600"><Trash size={16} /></button>
                </div>
              )
            })}
            {cart.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="font-bold text-lg text-gray-800">{fmt(total)}</span>
                </div>
                <button
                  className="w-full mt-3 bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  onClick={() => setView('checkout')}
                  disabled={!waToko}
                >
                  <BagPlusFill size={18} /> Lanjut Pesan
                </button>
                {!waToko && <p className="text-xs text-red-500 mt-2 text-center">Toko belum mengisi nomor WhatsApp pesanan.</p>}
              </>
            )}
          </div>
        )}

        {/* ===== Checkout ===== */}
        {view === 'checkout' && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 mt-4">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setView('keranjang')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
              <h2 className="font-bold text-gray-800">Data Pemesan</h2>
            </div>
            {/* ringkasan */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              {cart.map((i) => (
                <div key={i.id} className="flex justify-between text-sm py-0.5">
                  <span className="text-gray-600">{i.qty}× {i.nama}</span>
                  <span className="font-medium text-gray-800">{fmt(i.harga * i.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-200 mt-2 pt-2 font-bold">
                <span className="text-gray-800">Total</span>
                <span className="text-emerald-600">{fmt(total)}</span>
              </div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); kirimWa() }}
              className="space-y-3"
            >
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="pnama"><PersonCircle className="inline me-1" />Nama</label>
                <input id="pnama" required value={pemesan.nama}
                  onChange={(e) => setPemesan((s) => ({ ...s, nama: e.target.value }))}
                  placeholder="Nama lengkap"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="palamat"><GeoAlt className="inline me-1" />Alamat (opsional)</label>
                <input id="palamat" value={pemesan.alamat}
                  onChange={(e) => setPemesan((s) => ({ ...s, alamat: e.target.value }))}
                  placeholder="Alamat pengiriman"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="pcatatan">Catatan (opsional)</label>
                <textarea id="pcatatan" rows={2} value={pemesan.catatan}
                  onChange={(e) => setPemesan((s) => ({ ...s, catatan: e.target.value }))}
                  placeholder="Catatan tambahan"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2">
                <Whatsapp size={18} /> Kirim via WhatsApp
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ===== Sticky cart bar (hanya katalog) ===== */}
      {view === 'katalog' && cart.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-20">
          <button
            onClick={() => setView('keranjang')}
            className="w-full bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/30 px-4 py-3.5 flex items-center justify-between font-bold hover:bg-emerald-700 transition"
          >
            <span className="flex items-center gap-2">
              <div className="relative">
                <BagPlusFill size={20} />
                <span className="absolute -top-2 -right-3 bg-white text-emerald-700 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">
                  {totalItem}
                </span>
              </div>
              Lihat Keranjang
            </span>
            <span>{fmt(total)}</span>
          </button>
        </div>
      )}

      {/* ===== Modal detail produk ===== */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setDetailId(null)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button onClick={() => setDetailId(null)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"><X size={18} /></button>
            </div>
            <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center mb-4">
              {detail.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.foto} alt={detail.nama} className="w-full h-full object-cover" />
              ) : (
                <span className="text-8xl">{detail.emoji}</span>
              )}
            </div>
            {detail.kategori && (
              <span className="text-[11px] bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">{detail.kategori}</span>
            )}
            <h2 className="text-xl font-bold text-gray-800 mt-2">{detail.nama}</h2>
            <p className="text-emerald-600 font-bold text-xl mt-1">{fmt(detail.harga)}</p>
            {detail.deskripsi && <p className="text-sm text-gray-500 mt-2">{detail.deskripsi}</p>}
            {detail.stok > 0
              ? <p className="text-xs text-gray-400 mt-2">Tersedia {detail.stok} pcs</p>
              : <p className="text-xs text-red-500 font-medium mt-2">Stok habis</p>}
            <button
              onClick={() => { tambah(detail); setDetailId(null) }}
              disabled={detail.stok <= 0}
              className="w-full mt-4 bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Tambah {detail.stok > 0 ? 'ke Keranjang' : '(Habis)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
