'use client'

import { useState, useEffect, useCallback } from 'react'
import { fmt, fmtDate } from '@/lib/utils'
import { LaporanHarian, ProdukTerlaris, Transaksi, Shift } from '@/types'
import { TrendingUp, Receipt, ShoppingBag, Percent, Ban, Clock } from 'lucide-react'

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmtDT = (d: string) => `${fmtDate(d)} ${fmtTime(d)}`

export default function LaporanPage() {
  const [tab, setTab] = useState<'ringkasan' | 'shift'>('ringkasan')

  // --- Ringkasan ---
  const [laporan, setLaporan] = useState<LaporanHarian[]>([])
  const [terlaris, setTerlaris] = useState<ProdukTerlaris[]>([])
  const [riwayat, setRiwayat] = useState<Transaksi[]>([])
  const [loadingRingkasan, setLoadingRingkasan] = useState(true)

  // --- Shift ---
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loadingShift, setLoadingShift] = useState(false)
  const [shiftLoaded, setShiftLoaded] = useState(false)

  const loadRingkasan = useCallback(async () => {
    const res = await fetch('/api/laporan')
    if (res.ok) {
      const { laporan, terlaris, riwayat } = await res.json()
      setLaporan(laporan)
      setTerlaris(terlaris)
      setRiwayat(riwayat)
    }
    setLoadingRingkasan(false)
  }, [])

  const loadShift = useCallback(async () => {
    if (shiftLoaded) return
    setLoadingShift(true)
    const res = await fetch('/api/shift')
    if (res.ok) setShifts(await res.json())
    setLoadingShift(false)
    setShiftLoaded(true)
  }, [shiftLoaded])

  useEffect(() => { loadRingkasan() }, [loadRingkasan])
  useEffect(() => { if (tab === 'shift') loadShift() }, [tab, loadShift])

  const batalkan = async (id?: number) => {
    if (!id || !confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return
    const res = await fetch(`/api/transaksi/${id}`, { method: 'PATCH' })
    if (res.ok) loadRingkasan()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Gagal membatalkan transaksi')
    }
  }

  const hari = laporan[0] || { total_penjualan: 0, jumlah_transaksi: 0, rata_rata: 0, total_diskon: 0 }

  const cards = [
    { label: 'Penjualan Hari Ini', val: fmt(hari.total_penjualan || 0), icon: TrendingUp, color: 'indigo' },
    { label: 'Jumlah Transaksi', val: String(hari.jumlah_transaksi || 0), icon: Receipt, color: 'teal' },
    { label: 'Rata-rata Transaksi', val: fmt(hari.rata_rata || 0), icon: ShoppingBag, color: 'amber' },
    { label: 'Total Diskon', val: fmt(hari.total_diskon || 0), icon: Percent, color: 'rose' },
  ]

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    teal: 'bg-teal-50 text-teal-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Laporan</h2>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['ringkasan', 'shift'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'ringkasan' ? 'Ringkasan' : 'Shift'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== TAB RINGKASAN ===== */}
      {tab === 'ringkasan' && (
        loadingRingkasan
          ? <div className="flex items-center justify-center h-64 text-gray-400">Memuat laporan...</div>
          : <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {cards.map(c => (
                  <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colorMap[c.color]}`}>
                      <c.icon size={18} />
                    </div>
                    <div className="text-xl font-bold text-gray-800">{c.val}</div>
                    <div className="text-xs text-gray-400 mt-1">{c.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Produk terlaris */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Produk Terlaris</h3>
                  {terlaris.length === 0
                    ? <p className="text-sm text-gray-300 text-center py-8">Belum ada data</p>
                    : <div className="space-y-3">
                        {terlaris.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-3">
                            <span className="text-xs text-gray-300 w-4">{i + 1}</span>
                            <span className="text-lg">{p.emoji}</span>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-700">{p.nama}</div>
                              <div className="text-xs text-gray-400">{p.total_qty}x terjual</div>
                            </div>
                            <div className="text-sm font-semibold text-indigo-700">{fmt(p.total_penjualan)}</div>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                {/* Riwayat transaksi */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Transaksi Terbaru</h3>
                  {riwayat.length === 0
                    ? <p className="text-sm text-gray-300 text-center py-8">Belum ada transaksi</p>
                    : <div className="space-y-3">
                        {riwayat.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-gray-500 flex items-center gap-1.5">
                                {t.no_transaksi}
                                {t.dibatalkan && (
                                  <span className="text-[10px] bg-red-50 text-red-500 font-semibold px-1.5 py-0.5 rounded-full">Dibatalkan</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 truncate">{t.created_at ? fmtDate(t.created_at) : ''} · {t.metode_bayar}{t.kasir ? ` · ${t.kasir}` : ''}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className={`text-sm font-semibold ${t.dibatalkan ? 'text-gray-300 line-through' : 'text-gray-800'}`}>{fmt(t.total)}</div>
                              {!t.dibatalkan && (
                                <button onClick={() => batalkan(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Batalkan transaksi">
                                  <Ban size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>

              {/* Laporan 7 hari */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Penjualan 7 Hari Terakhir</h3>
                {laporan.length === 0
                  ? <p className="text-sm text-gray-300 text-center py-8">Belum ada data</p>
                  : <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b border-gray-100">
                          <th className="text-left py-2">Tanggal</th>
                          <th className="text-right py-2">Transaksi</th>
                          <th className="text-right py-2">Total</th>
                          <th className="text-right py-2">Rata-rata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {laporan.map((l, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="py-2.5 text-gray-700">{fmtDate(l.tanggal)}</td>
                            <td className="py-2.5 text-right text-gray-500">{l.jumlah_transaksi}x</td>
                            <td className="py-2.5 text-right font-medium text-gray-800">{fmt(l.total_penjualan)}</td>
                            <td className="py-2.5 text-right text-gray-500">{fmt(l.rata_rata)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </>
      )}

      {/* ===== TAB SHIFT ===== */}
      {tab === 'shift' && (
        loadingShift
          ? <div className="flex items-center justify-center h-64 text-gray-400">Memuat data shift...</div>
          : shifts.length === 0
            ? <div className="flex items-center justify-center h-64 text-gray-400">Belum ada shift tercatat</div>
            : <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-3">
                  {shifts.map(s => {
                    const nonTunai = (s.total_qris || 0) + (s.total_transfer || 0)
                    return (
                      <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {s.aktif && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                            <span className="font-medium text-gray-800">{s.kasir_nama}</span>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.aktif ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                            {s.aktif ? 'Aktif' : 'Selesai'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 space-y-0.5">
                          <div>Buka: {fmtDT(s.buka_at)}</div>
                          {s.tutup_at && <div>Tutup: {fmtDT(s.tutup_at)}</div>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-50 text-center">
                          <div>
                            <div className="text-xs text-gray-400">Tunai</div>
                            <div className="text-sm font-medium text-gray-700">{fmt(s.total_tunai || 0)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Non-Tunai</div>
                            <div className="text-sm font-medium text-gray-700">{fmt(nonTunai)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Total</div>
                            <div className="text-sm font-semibold text-indigo-700">{fmt(s.total_penjualan || 0)}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 text-center">{s.jumlah_transaksi ?? 0} transaksi</div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-xs text-gray-400">
                        <th className="text-left px-4 py-3">Kasir</th>
                        <th className="text-left px-4 py-3">Buka</th>
                        <th className="text-left px-4 py-3">Tutup</th>
                        <th className="text-right px-4 py-3">Trx</th>
                        <th className="text-right px-4 py-3">Tunai</th>
                        <th className="text-right px-4 py-3">Non-Tunai</th>
                        <th className="text-right px-4 py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map(s => {
                        const nonTunai = (s.total_qris || 0) + (s.total_transfer || 0)
                        return (
                          <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              <div className="flex items-center gap-2">
                                {s.aktif && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                                {s.kasir_nama}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{fmtDT(s.buka_at)}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {s.tutup_at ? fmtDT(s.tutup_at) : <span className="text-emerald-500">Aktif</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">{s.jumlah_transaksi ?? 0}x</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(s.total_tunai || 0)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(nonTunai)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(s.total_penjualan || 0)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
      )}
    </div>
  )
}
