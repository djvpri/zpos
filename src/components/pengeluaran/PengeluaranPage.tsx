'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CashCoin, PlusLg, XCircle, ArrowCounterclockwise,
} from 'react-bootstrap-icons'

// Halaman Pengeluaran (kas keluar). Admin & kasir lihat sesuai role.
// Alur: list pengeluaran (+filter tanggal) → tambah manual → void salah input.
// Saldo kas = modal + penjualan tunai − pengeluaran (dihitung server).

interface Pengeluaran {
  id: number
  shift_id: number | null
  kasir_nama: string | null
  kategori: string
  nominal: number
  catatan: string | null
  void: boolean
  dibuat_at: string
}

export const KATEGORI: { value: string; label: string }[] = [
  { value: 'belanja_stok', label: 'Belanja stok' },
  { value: 'operasional', label: 'Operasional' },
  { value: 'gaji', label: 'Gaji' },
  { value: 'transport', label: 'Transport' },
  { value: 'lainnya', label: 'Lainnya' },
]

const KAT_LABEL: Record<string, string> = Object.fromEntries(KATEGORI.map(k => [k.value, k.label]))

function fmtRupiah(v: number): string {
  return 'Rp ' + Number(v || 0).toLocaleString('id-ID')
}

function fmtTgl(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function PengeluaranPage() {
  const [rows, setRows] = useState<Pengeluaran[]>([])
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // form tambah
  const [openForm, setOpenForm] = useState(false)
  const [nominal, setNominal] = useState('')
  const [kategori, setKategori] = useState('belanja_stok')
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  const muat = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const q = new URLSearchParams()
      if (dari) q.set('dari', dari)
      if (sampai) q.set('sampai', sampai)
      const res = await fetch('/api/kas-keluar' + (q.toString() ? '?' + q : ''))
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal memuat')
      setRows(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }, [dari, sampai])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState di dalam async fetch (setelah await), bukan sinkron; fetch-on-mount sah.
  useEffect(() => { muat() }, [muat])

  const simpan = async () => {
    const n = parseInt(nominal.replace(/\D/g, ''), 10)
    if (!n || n <= 0) { setError('Isi nominal > 0.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/kas-keluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori, nominal: n, catatan }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal simpan')
      setOpenForm(false); setNominal(''); setCatatan(''); setKategori('belanja_stok')
      await muat()
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const voidRow = async (r: Pengeluaran) => {
    if (!confirm('Batalkan pengeluaran ' + fmtRupiah(r.nominal) + ' (' + (KAT_LABEL[r.kategori] || r.kategori) + ')?')) return
    try {
      const res = await fetch('/api/kas-keluar/' + r.id, { method: 'PATCH' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal membatalkan')
      await muat()
    } catch (e) { setError((e as Error).message) }
  }

  const total = rows.filter(r => !r.void).reduce((s, r) => s + r.nominal, 0)

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <CashCoin className="text-emerald-500" /> Pengeluaran Kas
        </h1>
        <button onClick={() => setOpenForm(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <PlusLg size={14} /> Kas Keluar
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <input type="date" value={dari} onChange={e => setDari(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
        <span className="text-gray-400">s/d</span>
        <input type="date" value={sampai} onChange={e => setSampai(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
        <button onClick={muat} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm">
          <ArrowCounterclockwise size={13} /> Filter
        </button>
        {total > 0 && (
          <span className="ml-auto text-sm font-semibold text-gray-700">
            Total pengeluaran: <span className="text-emerald-600">{fmtRupiah(total)}</span>
          </span>
        )}
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
              <th className="px-4 py-2.5 font-medium">Tanggal</th>
              <th className="px-4 py-2.5 font-medium">Kategori</th>
              <th className="px-4 py-2.5 font-medium">Nominal</th>
              <th className="px-4 py-2.5 font-medium">Catatan</th>
              <th className="px-4 py-2.5 font-medium">Oleh</th>
              <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada pengeluaran.</td></tr>}
            {!loading && rows.map(r => (
              <tr key={r.id} className={`border-b border-gray-50 ${r.void ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5 text-gray-600">{fmtTgl(r.dibuat_at)}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-600">
                    {KAT_LABEL[r.kategori] || r.kategori}
                  </span>
                  {r.void && <span className="ml-1 inline-block px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-500">void</span>}
                </td>
                <td className="px-4 py-2.5 font-medium">{fmtRupiah(r.nominal)}</td>
                <td className="px-4 py-2.5 text-gray-600 max-w-[220px] truncate">{r.catatan || '—'}</td>
                <td className="px-4 py-2.5 text-gray-500">{r.kasir_nama || '—'}{r.shift_id ? ` (#${r.shift_id})` : ''}</td>
                <td className="px-4 py-2.5 text-right">
                  {!r.void && (
                    <button onClick={() => voidRow(r)} title="Batalkan"
                      className="text-gray-300 hover:text-red-500">
                      <XCircle size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setOpenForm(false)}>
          <div className="bg-white rounded-2xl w-[360px] p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CashCoin className="text-emerald-500" /> Catat Kas Keluar
            </h3>
            <input autoFocus value={nominal} onChange={e => setNominal(e.target.value.replace(/\D/g, ''))}
              placeholder="Nominal (Rp)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              onKeyDown={e => e.key === 'Enter' && simpan()} />
            <select value={kategori} onChange={e => setKategori(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none">
              {KATEGORI.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input value={catatan} onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan (mis. beli galon)"
              maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              onKeyDown={e => e.key === 'Enter' && simpan()} />
            {error && <div className="text-xs text-red-500">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpenForm(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm">Batal</button>
              <button onClick={simpan} disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
