'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet2, XLg } from 'react-bootstrap-icons'

interface ProdukDigital {
  id: number
  nama: string
  harga: number
  modal: number | null
  buyer_sku_code: string | null
  digital_brand: string | null
  margin_type: string | null
  margin_persen: number | null
  margin_nominal: number | null
  toko_nama: string
  toko_id: number
  aktif: boolean
}

// Model: tenant beli pulsa = MODAL Digiflazz + MARGIN OWNER (ditarik dari saldo tenant).
// margin bisa PERSEN(%) thd modal ATAU NOMINAL (Rp tetap). Diset owner di sini.
// Tenant TIDAK bisa ubah margin (harga debet tenant dihitung di server dari sini).
export default function AdminPulsa() {
  const [rows, setRows] = useState<ProdukDigital[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<ProdukDigital | null>(null)
  const [form, setForm] = useState({ margin_type: 'persen', margin_persen: '10', margin_nominal: '0' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/produk-digital')
    if (res.ok) setRows((await res.json()).rows)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const openEdit = (p: ProdukDigital) => {
    setEdit(p)
    setForm({
      margin_type: p.margin_type === 'nominal' ? 'nominal' : 'persen',
      margin_persen: String(p.margin_persen ?? ''),
      margin_nominal: String(p.margin_nominal ?? ''),
    })
    setError('')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    setSaving(true); setError('')
    const body = {
      margin_type: form.margin_type,
      margin_persen: form.margin_type === 'persen' ? Number(form.margin_persen) || 0 : null,
      margin_nominal: form.margin_type === 'nominal' ? Number(form.margin_nominal) || 0 : null,
    }
    const res = await fetch(`/api/admin/produk-margin/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Markup Produk Pulsa</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Harga debet saldo tenant = modal Digiflazz + margin owner. Persen (%) thd modal, atau nominal (Rp).
        </p>
      </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Wallet2 size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Belum ada produk digital</p>
            <p className="text-gray-400 text-sm mt-1">Tenant menambah produk pulsa (jenis digital + kode Digiflazz) di toko mereka</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Wallet2 size={16} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{p.nama} {p.buyer_sku_code && <span className="text-gray-400 font-normal">({p.buyer_sku_code})</span>}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {p.toko_nama} · {p.digital_brand === 'pasca' ? 'Pasca' : 'Prabayar'} · modal Rp {Number(p.modal ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${p.margin_type === 'nominal' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
                  {p.margin_type === 'nominal'
                    ? `+Rp ${Number(p.margin_nominal ?? 0).toLocaleString('id-ID')}`
                    : `+${Number(p.margin_persen ?? 0)}%`}
                </span>
                <button
                  onClick={() => openEdit(p)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-colors shrink-0"
                >
                  Set Margin
                </button>
              </div>
            ))}
          </div>
        )}

      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 truncate">Margin {edit.nama}</h3>
              <button onClick={() => setEdit(null)} className="p-1 text-gray-400 hover:text-gray-600"><XLg size={18} /></button>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              {edit.toko_nama} · modal Digiflazz Rp {Number(edit.modal ?? 0).toLocaleString('id-ID')}
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
                = <b>Rp {((Number(edit.modal ?? 0) + (form.margin_type === 'nominal' ? Number(form.margin_nominal) || 0 : Math.round((Number(edit.modal ?? 0) * (Number(form.margin_persen) || 0)) / 100)))).toLocaleString('id-ID')}</b>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Margin'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
