'use client'

import { useState } from 'react'
import { ClockFill, PlayCircle, StopCircle, XLg } from 'react-bootstrap-icons'
import { useShift } from '@/hooks/useShift'
import { fmt } from '@/lib/utils'
import type { Shift } from '@/types'

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

// Modal: rekap shift setelah tutup
function RekapModal({ rekap, onTutup }: { rekap: Shift; onTutup: () => void }) {
  const kasAkhir = (rekap.modal_awal || 0) + (rekap.total_tunai || 0) - (rekap.total_kas_keluar || 0)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-80 shadow-xl overflow-hidden">
        <div className="bg-indigo-600 text-white px-5 py-4">
          <div className="font-semibold">Rekap Shift</div>
          <div className="text-xs text-indigo-200 mt-0.5">{rekap.kasir_nama}</div>
        </div>
        <div className="p-5 space-y-3">
          <Row label="Modal Awal" val={fmt(rekap.modal_awal || 0)} />
          <div className="border-t border-gray-100" />
          <Row label="Tunai" val={fmt(rekap.total_tunai || 0)} />
          <Row label="QRIS" val={fmt(rekap.total_qris || 0)} />
          <Row label="Transfer" val={fmt(rekap.total_transfer || 0)} />
          <Row label="Pengeluaran" val={fmt(rekap.total_kas_keluar || 0)} />
          <div className="border-t border-gray-100" />
          <Row label="Total Penjualan" val={fmt(rekap.total_penjualan || 0)} bold />
          <Row label="Saldo Kas" val={fmt(kasAkhir)} bold />
          <div className="text-xs text-gray-400 text-center">{rekap.jumlah_transaksi || 0} transaksi</div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={onTutup} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, val, bold }: { label: string; val: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span>{val}</span>
    </div>
  )
}

// Kategori pengeluaran (sama dgn backend /api/kas-keluar).
const KATEGORI_KAS = [
  { value: 'belanja_stok', label: 'Belanja stok' },
  { value: 'operasional', label: 'Operasional' },
  { value: 'gaji', label: 'Gaji' },
  { value: 'transport', label: 'Transport' },
  { value: 'lainnya', label: 'Lainnya' },
]

// Modal: catat pengeluaran kas (butuh shift aktif).
function KasKeluarModal({ onSimpan, onBatal }: { onSimpan: (nominal: number, kategori: string, catatan: string) => Promise<string | null>; onBatal: () => void }) {
  const [nominal, setNominal] = useState('')
  const [kategori, setKategori] = useState('belanja_stok')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const simpan = async () => {
    const n = parseInt(nominal.replace(/\D/g, ''), 10)
    if (!n || n <= 0) { setErr('Isi nominal > 0.'); return }
    setBusy(true); setErr('')
    const errMsg = await onSimpan(n, kategori, catatan)
    setBusy(false)
    if (errMsg) setErr(errMsg)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-80 shadow-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-800">{'Kas Keluar'}</span>
          <button onClick={onBatal} className="p-1 hover:bg-gray-100 rounded-lg"><XLg size={16} /></button>
        </div>
        <label className="text-xs font-medium text-gray-600">Nominal (Rp)</label>
        <input
          type="text" inputMode="numeric"
          value={nominal} onChange={e => setNominal(e.target.value.replace(/\D/g, ''))}
          placeholder="0"
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        <select
          value={kategori} onChange={e => setKategori(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-indigo-400"
        >
          {KATEGORI_KAS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <input
          type="text"
          value={catatan} onChange={e => setCatatan(e.target.value)}
          placeholder="Catatan (mis. beli galon)"
          maxLength={200}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        {err && <div className="text-xs text-red-500">{err}</div>}
        <button
          onClick={simpan} disabled={busy}
          className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
        >
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}

// Modal: buka shift
function BukaModal({ onBuka, onBatal }: { onBuka: (modal: number) => void; onBatal: () => void }) {
  const [modal, setModal] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-72 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-gray-800">Mulai Shift</span>
          <button onClick={onBatal} className="p-1 hover:bg-gray-100 rounded-lg"><XLg size={16} /></button>
        </div>
        <label className="text-xs font-medium text-gray-600">Modal Awal Kas (opsional)</label>
        <input
          type="number" min={0} step={1000}
          value={modal}
          onChange={e => setModal(e.target.value)}
          placeholder="0"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1 outline-none focus:border-indigo-400"
          autoFocus
        />
        <button
          onClick={() => onBuka(Number(modal) || 0)}
          className="mt-4 w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Mulai Shift
        </button>
      </div>
    </div>
  )
}

export function ShiftBanner() {
  const { shift, loading, buka, tutup, reload } = useShift()
  const [showBuka, setShowBuka] = useState(false)
  const [showRekap, setShowRekap] = useState(false)
  const [showKas, setShowKas] = useState(false)
  const [rekap, setRekap] = useState<Shift | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleBuka = async (modalAwal: number) => {
    setBusy(true)
    setErr('')
    const res = await buka(modalAwal)
    setBusy(false)
    if (res.error) { setErr(res.error); return }
    setShowBuka(false)
  }

  // Simpan pengeluaran kas via API (shift wajib aktif). Return pesan err / null.
  const simpanKas = async (nominal: number, kategori: string, catatan: string): Promise<string | null> => {
    if (!shift) return 'Belum ada shift aktif.'
    let res: Response
    try {
      res = await fetch('/api/kas-keluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shift.id, kategori, nominal, catatan }),
      })
    } catch {
      return 'Tidak ada koneksi. Coba lagi setelah koneksi kembali.'
    }
    await reload()
    if (res.ok) { setShowKas(false); return null }
    const data = await res.json().catch(() => ({}))
    return data.error || 'Gagal mencatat pengeluaran.'
  }

  const handleTutup = async () => {
    if (!confirm('Tutup shift sekarang?')) return
    setBusy(true)
    const res = await tutup()
    setBusy(false)
    if (res.error) { setErr(res.error); return }
    if (res.data) { setRekap(res.data); setShowRekap(true) }
  }

  if (loading) return null

  return (
    <>
      {!shift ? (
        <div className="mx-4 mt-3 md:mx-4 md:mt-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <ClockFill size={15} />
            <span>Shift belum dimulai</span>
          </div>
          <button
            onClick={() => setShowBuka(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors"
          >
            <PlayCircle size={13} /> Mulai Shift
          </button>
        </div>
      ) : (
        <div className="mx-4 mt-3 md:mx-4 md:mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <ClockFill size={15} />
            <span>Shift aktif sejak {fmtTime(shift.buka_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={busy}
              onClick={() => setShowKas(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              Kas Keluar
            </button>
            <button
              disabled={busy}
              onClick={handleTutup}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <StopCircle size={13} /> Tutup Shift
            </button>
          </div>
        </div>
      )}

      {err && <div className="mx-4 mt-1 text-xs text-red-500">{err}</div>}

      {showKas && (
        <KasKeluarModal
          onSimpan={simpanKas}
          onBatal={() => setShowKas(false)}
        />
      )}

      {showBuka && (
        <BukaModal
          onBuka={handleBuka}
          onBatal={() => setShowBuka(false)}
        />
      )}

      {showRekap && rekap && (
        <RekapModal
          rekap={rekap}
          onTutup={() => { setShowRekap(false); setRekap(null) }}
        />
      )}
    </>
  )
}
