'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet2, Search, XLg, ArrowClockwise } from 'react-bootstrap-icons'

interface PricelistItem {
  product_name: string
  category: string
  brand: string
  type: string
  price: number
  buyer_sku_code: string
  buyer_product_status: boolean
  sudah_produk?: boolean
  desc?: string
}

type Jenis = 'prepaid' | 'pasca'

export default function AdminPricelist() {
  const [prepaid, setPrepaid] = useState<PricelistItem[]>([])
  const [pasca, setPasca] = useState<PricelistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [jenis, setJenis] = useState<Jenis>('prepaid')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/digiflazz/pricelist${refresh ? '?refresh=1' : ''}`)
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Gagal ambil price list') }
      const d = await res.json()
      setPrepaid(d.prepaid ?? [])
      setPasca(d.pasca ?? [])
    } catch (e) { setError((e as Error).message) }
    setLoading(false); setRefreshing(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const list = jenis === 'prepaid' ? prepaid : pasca
  const filter = list.filter((p) =>
    (!cat || p.category === cat) &&
    (!q || p.product_name.toLowerCase().includes(q.toLowerCase()) || p.buyer_sku_code.toLowerCase().includes(q.toLowerCase()))
  )
  const cats = Array.from(new Set(list.map((p) => p.category))).sort()

  const refresh = async () => { setRefreshing(true); await load(true) }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Daftar Produk Digiflazz</h1>
          <p className="text-sm text-gray-400 mt-0.5">Harga dasar (modal) dari API Digiflazz · {prepaid.length + pasca.length} produk</p>
        </div>
        <button
          onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
        >
          <ArrowClockwise size={15} className={refreshing ? 'animate-spin' : ''} /> Segarkan Harga
        </button>
      </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl mb-4">{error}</div>}

        {/* Tab jenis */}
        <div className="flex gap-2 mb-4">
          {(['prepaid', 'pasca'] as Jenis[]).map((j) => (
            <button
              key={j} onClick={() => setJenis(j)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${jenis === j ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {j === 'prepaid' ? 'Prabayar' : 'Pascabayar'} ({j === 'prepaid' ? prepaid.length : pasca.length})
            </button>
          ))}
        </div>

        {/* Search + filter kategori */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama / kode..."
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors bg-white"
            />
          </div>
          <select
            value={cat} onChange={(e) => setCat(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors bg-white"
          >
            <option value="">Semua kategori</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(q || cat) && (
            <button onClick={() => { setQ(''); setCat('') }} className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors" title="Reset filter">
              <XLg size={15} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
        ) : filter.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Wallet2 size={22} className="text-gray-400" /></div>
            <p className="text-gray-500 font-medium">Tidak ada produk</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Produk</th>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 font-semibold">Merek</th>
                    <th className="px-4 py-3 font-semibold">Kode</th>
                    <th className="px-4 py-3 font-semibold text-right">Harga Dasar</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filter.map((p, i) => (
                    <tr key={p.buyer_sku_code + i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">{p.product_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{p.category}</td>
                      <td className="px-4 py-2.5 text-gray-500">{p.brand}</td>
                      <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{p.buyer_sku_code}</td>
                      <td className="px-4 py-2.5 text-right text-gray-800 font-medium">{Number(p.price ?? 0).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2.5">
                        {p.sudah_produk ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Sudah jadi produk</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Belum</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )
}
