'use client'

import { useState, useEffect, useCallback } from 'react'
import { fmt, fmtDate } from '@/lib/utils'
import { LaporanHarian, ProdukTerlaris, Transaksi, Shift } from '@/types'
import { GraphUpArrow, Receipt, Bag, Percent, Ban, Download, ArrowClockwise, Trophy, Printer } from 'react-bootstrap-icons'
import { cacheGet, cacheSet } from '@/lib/offline-cache'
import { useAuth } from '@/hooks/useAuth'
import { usePengaturan } from '@/hooks/usePengaturan'
import { StrukModal } from '@/components/kasir/StrukModal'
import { LaporanStrukModal } from '@/components/laporan/LaporanStrukModal'

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmtDT = (d: string) => `${fmtDate(d)} ${fmtTime(d)}`

interface BonRow {
  id: number
  nama: string | null
  produk: Record<string, number>
  total: number
  selesai: boolean
  created_at: string
  dibayar_at: string | null
}

// Satu baris log aktivitas (audit anti-kecurangan).
interface AktivitasRow {
  id: number
  nama_user: string | null
  aksi: string
  keterangan: string
  created_at: string
}

// Label + warna chip per aksi (fallback ke default abu-abu).
const AKTIVITAS_LABEL: Record<string, { label: string; cls: string }> = {
  login: { label: 'Login', cls: 'bg-indigo-50 text-indigo-600' },
  transaksi_buat: { label: 'Transaksi', cls: 'bg-emerald-50 text-emerald-600' },
  transaksi_batal: { label: 'Batalkan Trx', cls: 'bg-red-50 text-red-600' },
  produk_ubah: { label: 'Ubah Produk', cls: 'bg-amber-50 text-amber-600' },
  produk_hapus: { label: 'Hapus Produk', cls: 'bg-red-50 text-red-600' },
  member_ubah: { label: 'Ubah Member', cls: 'bg-sky-50 text-sky-600' },
  member_hapus: { label: 'Hapus Member', cls: 'bg-red-50 text-red-600' },
  shift_buka: { label: 'Buka Shift', cls: 'bg-emerald-50 text-emerald-600' },
  shift_tutup: { label: 'Tutup Shift', cls: 'bg-violet-50 text-violet-600' },
  bon_bayar: { label: 'Bayar Bon', cls: 'bg-teal-50 text-teal-600' },
  staff_ubah: { label: 'Ubah Staff', cls: 'bg-amber-50 text-amber-600' },
  staff_hapus: { label: 'Hapus Staff', cls: 'bg-red-50 text-red-600' },
  staff_tambah: { label: 'Aktifkan Staff', cls: 'bg-emerald-50 text-emerald-600' },
  data_hapus: { label: 'Hapus Data', cls: 'bg-red-50 text-red-600' },
}

const aksiInfo = (aksi: string) =>
  AKTIVITAS_LABEL[aksi] ?? { label: aksi.replace(/_/g, ' '), cls: 'bg-gray-100 text-gray-600' }

export default function LaporanPage() {
  const [tab, setTab] = useState<'ringkasan' | 'shift' | 'bon' | 'log'>('ringkasan')

  // --- Ringkasan ---
  const [laporan, setLaporan] = useState<LaporanHarian[]>([])
  const [terlaris, setTerlaris] = useState<ProdukTerlaris[]>([])
  const [riwayat, setRiwayat] = useState<Transaksi[]>([])
  const [loadingRingkasan, setLoadingRingkasan] = useState(true)
  const [strukCetak, setStrukCetak] = useState<Transaksi | null>(null)
  const [lapCetak, setLapCetak] = useState<LaporanHarian | null>(null)

  // Info toko utk render nota (nama, alamat, telp, catatan struk).
  const { toko } = useAuth()
  const { alamat, telepon, catatan_struk } = usePengaturan()

  // --- Shift ---
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loadingShift, setLoadingShift] = useState(false)
  const [shiftLoaded, setShiftLoaded] = useState(false)

  // --- Bon gantung ---
  const [bon, setBon] = useState<BonRow[]>([])
  const [loadingBon, setLoadingBon] = useState(false)
  const [bonLoaded, setBonLoaded] = useState(false)

  // --- Log aktivitas (audit anti-kecurangan) ---
  const [log, setLog] = useState<AktivitasRow[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [logLoaded, setLogLoaded] = useState(false)

  const loadRingkasan = useCallback(async () => {
    try {
      const res = await fetch('/api/laporan')
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      setLaporan(data.laporan)
      setTerlaris(data.terlaris)
      setRiwayat(data.riwayat)
      cacheSet('laporan', data).catch(() => {})
    } catch {
      // Offline — pakai laporan terakhir yang berhasil dimuat, supaya owner
      // tetap bisa lihat ringkasan (walau bukan data paling baru) alih-alih
      // layar kosong. Transaksi yang masih di antrian offline (belum
      // tersinkron) TIDAK ikut di sini karena belum pernah sampai ke
      // server — baru muncul di laporan setelah berhasil sinkron.
      const cached = await cacheGet<{ laporan: LaporanHarian[]; terlaris: ProdukTerlaris[]; riwayat: Transaksi[] }>('laporan').catch(() => null)
      if (cached) {
        setLaporan(cached.laporan)
        setTerlaris(cached.terlaris)
        setRiwayat(cached.riwayat)
      }
    }
    setLoadingRingkasan(false)
  }, [])

  const loadShift = useCallback(async () => {
    if (shiftLoaded) return
    setLoadingShift(true)
    try {
      const res = await fetch('/api/shift')
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      setShifts(data)
      cacheSet('riwayat-shift', data).catch(() => {})
    } catch {
      const cached = await cacheGet<Shift[]>('riwayat-shift').catch(() => null)
      if (cached) setShifts(cached)
    }
    setLoadingShift(false)
    setShiftLoaded(true)
  }, [shiftLoaded])

  const loadBonus = useCallback(async () => {
    if (bonLoaded) return
    setLoadingBon(true)
    try {
      const res = await fetch('/api/bon?semua=1')
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      setBon(data)
      cacheSet('bon', data).catch(() => {})
    } catch {
      const cached = await cacheGet<BonRow[]>('bon').catch(() => null)
      if (cached) setBon(cached)
    }
    setLoadingBon(false)
    setBonLoaded(true)
  }, [bonLoaded])

  const loadLog = useCallback(async () => {
    if (logLoaded) return
    setLoadingLog(true)
    try {
      const res = await fetch('/api/aktivitas?limit=500')
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      setLog(Array.isArray(data) ? data : [])
    } catch {
      // Log tak punya cache offline — audit harus dari server (data terbaru).
      setLog([])
    }
    setLoadingLog(false)
    setLogLoaded(true)
  }, [logLoaded])

  const exportLogCSV = () => {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v)
      return `"${s.replace(/\"/g, '""')}"`
    }
    const head = ['Waktu', 'User', 'Aksi', 'Detail']
    const rows = log.map(l => [
      l.created_at ? fmtDT(l.created_at) : '',
      l.nama_user || '-',
      aksiInfo(l.aksi).label,
      l.keterangan,
    ])
    const csv = '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export daftar bon utk file CSV (Excel-compatible: BOM + pemisah ;).
  const exportBonCSV = () => {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
    const head = ['ID', 'Member', 'Jumlah Item', 'Total (Rp)', 'Status', 'Dibuat', 'Dibayar']
    const rows = bon.map(b => [
      b.id, b.nama || '-',
      Object.values(b.produk).reduce((s, n) => s + n, 0),
      b.total, b.selesai ? 'Selesai' : 'Belum Dibayar',
      b.created_at ? fmtDT(b.created_at) : '', b.dibayar_at ? fmtDT(b.dibayar_at) : '',
    ])
    const csv = '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bon-gantung-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => { Promise.resolve().then(() => loadRingkasan()) }, [loadRingkasan])
  useEffect(() => { if (tab === 'shift') Promise.resolve().then(() => loadShift()) }, [tab, loadShift])
  useEffect(() => { if (tab === 'bon') Promise.resolve().then(() => loadBonus()) }, [tab, loadBonus])
  useEffect(() => { if (tab === 'log') Promise.resolve().then(() => loadLog()) }, [tab, loadLog])

  const batalkan = async (id?: number) => {
    if (!id || !confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return
    const res = await fetch(`/api/transaksi/${id}`, { method: 'PATCH' })
    if (res.ok) loadRingkasan()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Gagal membatalkan transaksi')
    }
  }

  // Cetak ulang nota transaksi lama: tarik detail (items) dari server,
  // lalu tampilkan lewat StrukModal (renderer nota yang sama dgn kasir).
  const cetakUlang = async (id?: number) => {
    if (!id) return
    try {
      const res = await fetch(`/api/transaksi/${id}`)
      if (!res.ok) throw new Error('gagal')
      const trx = await res.json()
      setStrukCetak(trx)
    } catch {
      alert('Gagal memuat detail transaksi. Pastikan koneksi online.')
    }
  }

  const hari = laporan[0] || { total_penjualan: 0, jumlah_transaksi: 0, rata_rata: 0, total_diskon: 0 }

  const cards = [
    { label: 'Penjualan Hari Ini', val: fmt(hari.total_penjualan || 0), icon: GraphUpArrow, color: 'indigo' },
    { label: 'Jumlah Transaksi', val: String(hari.jumlah_transaksi || 0), icon: Receipt, color: 'teal' },
    { label: 'Rata-rata Transaksi', val: fmt(hari.rata_rata || 0), icon: Bag, color: 'amber' },
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
          {(['ringkasan', 'shift', 'bon', 'log'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'ringkasan' ? 'Ringkasan' : t === 'shift' ? 'Shift' : t === 'bon' ? 'Bon' : 'Log'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== TAB RINGKASAN ===== */}
      {tab === 'ringkasan' && (
        loadingRingkasan
          ? <div className="flex items-center justify-center h-64 text-gray-400">Memuat laporan...</div>
          : <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Ringkasan penjualan <b className="text-gray-700">{laporan[0] ? fmtDate(laporan[0].tanggal) : ''}</b></p>
                <button
                  onClick={() => setLapCetak(laporan[0] || null)}
                  disabled={!laporan[0]}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  <Printer size={13} /> Cetak Laporan
                </button>
              </div>
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
                            <span className="text-amber-500"><Trophy size={16} /></span>
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
                              <button onClick={() => cetakUlang(t.id)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Cetak ulang nota">
                                <Printer size={14} />
                              </button>
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
          </div>
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
      {/* ===== TAB BON ===== */}
      {tab === 'bon' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Daftar bon gantung ({bon.length} total). Klik <b className="text-gray-700">Export CSV</b> untuk unduh.</p>
            <div className="flex gap-2">
              <button onClick={() => { setBonLoaded(false); loadBonus() }}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors">
                <ArrowClockwise size={13} /> Muat ulang
              </button>
              <button onClick={exportBonCSV} disabled={bon.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          {loadingBon
            ? <div className="flex items-center justify-center h-40 text-gray-400">Memuat bon...</div>
            : bon.length === 0
              ? <div className="flex items-center justify-center h-40 text-gray-400">Belum ada bon gantung</div>
              : (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-xs text-gray-400">
                          <th className="text-left px-4 py-3">Member</th>
                          <th className="text-right px-4 py-3">Item</th>
                          <th className="text-right px-4 py-3">Total</th>
                          <th className="text-center px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Dibuat</th>
                          <th className="text-left px-4 py-3">Dibayar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bon.map(b => {
                          const item = Object.values(b.produk).reduce((s, n) => s + n, 0)
                          return (
                            <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-800">{b.nama || `Bon #${b.id}`}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{item}x</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(b.total)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.selesai ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {b.selesai ? 'Selesai' : 'Belum Dibayar'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{b.created_at ? fmtDT(b.created_at) : '-'}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{b.dibayar_at ? fmtDT(b.dibayar_at) : '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
        </div>
      )}
      {/* ===== TAB LOG AKTIVITAS ===== */}
      {tab === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Jadwal aktivitas sensitif (masuk/keluar, transaksi, ubah/hapus produk, shift, staff). Tercatat otomatis.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setLogLoaded(false); loadLog() }}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors">
                <ArrowClockwise size={13} /> Muat ulang
              </button>
              <button onClick={exportLogCSV} disabled={log.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          {loadingLog
            ? <div className="flex items-center justify-center h-40 text-gray-400">Memuat log...</div>
            : log.length === 0
              ? <div className="flex items-center justify-center h-40 text-gray-400">Belum ada aktivitas tercatat</div>
              : (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-xs text-gray-400">
                          <th className="text-left px-4 py-3">Waktu</th>
                          <th className="text-left px-4 py-3">User</th>
                          <th className="text-left px-4 py-3">Aksi</th>
                          <th className="text-left px-4 py-3">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.map(l => {
                          const info = aksiInfo(l.aksi)
                          return (
                            <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{l.created_at ? fmtDT(l.created_at) : '-'}</td>
                              <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{l.nama_user || 'System'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{l.keterangan}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
        </div>
      )}

      <StrukModal
        transaksi={strukCetak}
        toko={{ nama: toko?.nama ?? '', alamat, telepon, catatan_struk }}
        onTutup={() => setStrukCetak(null)}
      />
      {lapCetak && (
        <LaporanStrukModal
          data={lapCetak}
          namaToko={toko?.nama ?? ''}
          alamat={alamat}
          telepon={telepon}
          catatan_struk={catatan_struk}
          onTutup={() => setLapCetak(null)}
        />
      )}
    </div>
  )
}
