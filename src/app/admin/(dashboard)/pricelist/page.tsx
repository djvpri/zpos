'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet2, Search, XLg, ArrowClockwise, Sliders } from 'react-bootstrap-icons'

interface Margin { margin_type: string | null; margin_persen: number | null; margin_nominal: number | null }

interface PricelistItem {
  product_name: string
  category: string
  brand: string
  type: string
  price: number
  buyer_sku_code: string
  buyer_product_status: boolean
  sudah_produk?: boolean
  margin?: Margin | null
  desc?: string
}

type Jenis = 'prepaid' | 'pasca'

// Harga Pulsa = daftar produk Digiflazz (harga modal). Di sini owner set MARGIN
// per SKU sekali → berlaku utk SEMUA toko (server update semua row produk SKU).
// Pemilihan utk dijual tenant diurus alur "SKU otomatis ke toko" terpisah.
export default function AdminPricelist() {
  const [prepaid, setPrepaid] = useState<PricelistItem[]>([])
  const [pasca, setPasca] = useState<PricelistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [jenis, setJenis] = useState<Jenis>('prepaid')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Modal atur margin SKU
  const [edit, setEdit] = useState<PricelistItem | null>(null)
  const [form, setForm] = useState({ margin_type: 'persen', margin_persen: '10', margin_nominal: '0' })
  const [saving, setSaving] = useState(false)

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
  // defer agar setState tak sinkron dlm effect (react-hooks/set-state-in-effect)
  useEffect(() => {
    const id = requestAnimationFrame(() => void load())
    return () => cancelAnimationFrame(id)
  }, [load])

  const list = jenis === 'prepaid' ? prepaid : pasca
  const filter = list.filter((p) =>
    (!cat || p.category === cat) &&
    (!q || p.product_name.toLowerCase().includes(q.toLowerCase()) || p.buyer_sku_code.toLowerCase().includes(q.toLowerCase()))
  )
  const cats = Array.from(new Set(list.map((p) => p.category))).sort()

  const refresh = async () => { setRefreshing(true); await load(true) }

  // Sinkron master + aktifkan SEMUA SKU jadi produk di SEMUA toko (tombol owner).
  const aktifkanSemua = async () => {
    setSyncing(true); setSyncMsg(''); setError('')
    try {
      const res = await fetch('/api/admin/digiflazz/sync', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Gagal sinkron')
      if (d.perlu_migrasi) {
        setSyncMsg('⚠ Tabel master digital_sku belum ada — migrasi migration_digital_sku.sql dulu di server.')
      } else {
        setSyncMsg(`✓ ${d.sku} SKU · ${d.dibuat} produk baru dibuat · ${d.duplikat} sudah ada · ${d.toko} toko`)
      }
      await load()
    } catch (e) { setError((e as Error).message) }
    setSyncing(false)
  }

  const labelMargin = (m?: Margin | null) => {
    if (!m) return null
    return m.margin_type === 'nominal'
      ? `+Rp ${Number(m.margin_nominal ?? 0).toLocaleString('id-ID')}`
      : `+${Number(m.margin_persen ?? 0)}%`
  }

  const hasMargin = (m?: Margin | null) =>
    !!m && ((m.margin_type === 'nominal' && Number(m.margin_nominal) > 0) ||
      (m.margin_type !== 'nominal' && Number(m.margin_persen) > 0))

  const openEdit = (p: PricelistItem) => {
    setEdit(p)
    setForm({
      margin_type: p.margin?.margin_type === 'nominal' ? 'nominal' : 'persen',
      margin_persen: String(p.margin?.margin_persen ?? ''),
      margin_nominal: String(p.margin?.margin_nominal ?? ''),
    })
    setError('')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    setSaving(true); setError('')
    const body = {
      buyer_sku_code: edit.buyer_sku_code,
      margin_type: form.margin_type,
      margin_persen: form.margin_type === 'persen' ? Number(form.margin_persen) || 0 : null,
      margin_nominal: form.margin_type === 'nominal' ? Number(form.margin_nominal) || 0 : null,
    }
    const res = await fetch('/api/admin/digiflazz/margin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      await load()
      setEdit(null)
    } else {
      const d = await res.json(); setError(d.error || 'Gagal simpan')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Daftar Produk Digiflazz</h1>
          <p className="text-sm text-gray-400 mt-0.5">Harga dasar (modal) Digiflazz · {prepaid.length + pasca.length} produk · margin berlaku utk semua toko</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={refresh} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <ArrowClockwise size={15} className={refreshing ? 'animate-spin' : ''} /> Segarkan Harga
          </button>
          <button
            onClick={aktifkanSemua} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            title="Sinkron master + jadikan semua SKU Digiflazz produk digital di semua toko (idempotent)"
          >
            {syncing ? 'Menyinkronkan...' : '⚡ Aktifkan semua SKU ke semua toko'}
          </button>
        </div>
      </div>

        {syncMsg && (
          <div className="bg-emerald-50 text-emerald-700 text-sm px-3 py-2.5 rounded-xl mb-4">{syncMsg}</div>
        )}

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
                    <th className="px-4 py-3 font-semibold">Margin Owner</th>
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
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${hasMargin(p.margin) ? (p.margin?.margin_type === 'nominal' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600') : 'bg-gray-100 text-gray-400'}`}>
                            {hasMargin(p.margin) ? labelMargin(p.margin) : 'belum diatur'}
                          </span>
                          <button
                            onClick={() => openEdit(p)} disabled={!p.sudah_produk}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 ${p.sudah_produk ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                            title={p.sudah_produk ? 'Atur margin utk SKU ini (semua toko)' : 'Belum ada produk — aktif di toko dulu'}
                          >
                            <Sliders size={11} /> Set Margin
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {p.sudah_produk ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Sudah jadi produk</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Belum jadi produk</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900">Margin {edit.product_name}</h3>
              <button onClick={() => setEdit(null)} className="p-1 text-gray-400 hover:text-gray-600"><XLg size={18} /></button>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              {edit.buyer_sku_code} · modal Digiflazz Rp {Number(edit.price ?? 0).toLocaleString('id-ID')} · berlaku utk semua toko
            </p>
            <form onSubmit={save} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Tipe Margin</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, margin_type: 'persen' }))}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${form.margin_type === 'persen' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Persen (%)
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, margin_type: 'nominal' }))}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${form.margin_type === 'nominal' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Nominal (Rp)
                  </button>
                </div>
              </div>
              {form.margin_type === 'persen' ? (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Margin (%)</label>
                  <input type="number" min={0} value={form.margin_persen}
                    onChange={e => setForm(f => ({ ...f, margin_persen: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors" />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Margin Nominal (Rp)</label>
                  <input type="number" min={0} value={form.margin_nominal}
                    onChange={e => setForm(f => ({ ...f, margin_nominal: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors" />
                </div>
              )}
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-xs text-gray-500">
                Debit saldo tenant = modal + margin
                = <b>Rp {((Number(edit.price ?? 0) + (form.margin_type === 'nominal' ? Number(form.margin_nominal) || 0 : Math.round((Number(edit.price ?? 0) * (Number(form.margin_persen) || 0)) / 100)))).toLocaleString('id-ID')}</b>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Margin (semua toko)'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
