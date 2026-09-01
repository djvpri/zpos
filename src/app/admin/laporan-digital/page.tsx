'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BoxArrowRight, ShieldCheck, Wallet2, ChatSquareDots } from 'react-bootstrap-icons'
import { fmtDate } from '@/lib/utils'

interface Row {
  id: number
  transaksi_id: number
  buyer_sku_code: string
  customer_no: string
  ref_id: string
  commands: string
  modal: number | null
  harga_debet: number | null
  harga_jual: number
  status: string
  sn: string | null
  message: string | null
  created_at: string
  toko_nama: string
  toko_id: number
  margin_owner: number
}

const statusColor = (s: string) =>
  s === 'Sukses' ? 'bg-green-50 text-green-600' : s === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'

export default function AdminLaporanDigital() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [tokoList, setTokoList] = useState<{ id: number; nama: string }[]>([])
  const [toko, setToko] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = toko ? `?toko=${encodeURIComponent(toko)}` : ''
    const res = await fetch(`/api/admin/penjualan-digital${qs}`)
    if (res.ok) {
      const d = await res.json()
      setRows(d.rows); setTokoList(d.tokoList)
    }
    setLoading(false)
  }, [toko])
  useEffect(() => { void load() }, [load])

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); router.refresh() }

  const totalMargin = rows.reduce((a, r) => a + Number(r.margin_owner ?? 0), 0)
  const totalDebet = rows.filter(r => r.status !== 'Gagal').reduce((a, r) => a + Number(r.harga_debet ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center"><ChatSquareDots size={18} /></div>
            <span className="font-bold">Z1 Pos Admin · Penjualan Pulsa</span>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
            <BoxArrowRight size={15} /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Transaksi Pulsa</h1>
            <p className="text-sm text-gray-400 mt-0.5">Margin owner per item = harga debet tenant − modal Digiflazz</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={toko} onChange={e => setToko(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Semua toko</option>
              {tokoList.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
            <button onClick={() => router.push('/admin/pulsa')}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              Kelola Pulsa
            </button>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
              <div className="text-xs text-gray-400">Total Margin Owner</div>
              <div className="text-xl font-bold text-indigo-600">Rp {totalMargin.toLocaleString('id-ID')}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
              <div className="text-xs text-gray-400">Debit Saldo Tenant (Jalan)</div>
              <div className="text-xl font-bold text-gray-800">Rp {totalDebet.toLocaleString('id-ID')}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Belum ada transaksi pulsa</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Toko</th>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 text-right font-medium">Modal</th>
                  <th className="px-4 py-3 text-right font-medium">Debet</th>
                  <th className="px-4 py-3 text-right font-medium">Margin</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.toko_nama}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.buyer_sku_code}{r.sn && <span className="text-gray-400 text-xs block">SN {r.sn}</span>}</td>
                    <td className="px-4 py-2.5">{r.customer_no}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.modal ?? 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.harga_debet ?? 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-indigo-600 font-semibold">{Number(r.margin_owner ?? 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
