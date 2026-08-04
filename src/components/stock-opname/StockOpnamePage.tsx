'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ClipboardCheck, UpcScan, PlayFill, XCircle, Check2Circle,
  ArrowCounterclockwise, Clipboard2Check,
} from 'react-bootstrap-icons'

// Halaman Stock Opname (SO). Online-only. Alur:
//   1. Buka sesi (scope: semua / per kategori) → backend snapshot stok_sistem.
//   2. Scan barcode → stok_fisik (qty) naik, selisih fisik-sistem tampil live.
//   3. "Selesai" → hitung selisih utk semua produk dalam cakupan (yang tak discan
//      dianggap 0), status 'selesai'. stok BELUM berubah.
//   4. "Approve" → admin menulis produk.stok = stok_fisik. stok baru berubah.
// Barcode tak dikenal → peringatan (kasir cek manual), tak direkam sbg baris.

type Status = 'proses' | 'selesai' | 'disetujui' | 'dibatalkan'

interface SesiRow {
  id: number
  nomor_so: string
  nama: string
  scope: string
  status: Status
  jumlah_baris: number
  dibuat_oleh: string | null
  dibuat_at: string
  selesai_at: string | null
  disetujui_at: string | null
  total_selisih: number
  ada_selisih: number
}

interface BarisRow {
  produk_id: number
  nama: string | null
  barcode: string | null
  stok_sistem: number
  stok_fisik: number
  selisih: number
  kategori: string | null
}

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  proses: { label: 'Proses', cls: 'bg-blue-50 text-blue-600' },
  selesai: { label: 'Selesai', cls: 'bg-amber-50 text-amber-600' },
  disetujui: { label: 'Disetujui', cls: 'bg-green-50 text-green-600' },
  dibatalkan: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-400' },
}

function fmtTgl(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function StockOpnamePage() {
  const [kategori, setKategori] = useState<{ id: number; nama: string }[]>([])
  const [riwayat, setRiwayat] = useState<SesiRow[]>([])
  const [scope, setScope] = useState<'semua' | 'kategori'>('semua')
  const [kategoriId, setKategoriId] = useState<number | 0>(0)
  const [namaSesi, setNamaSesi] = useState('')
  const [membuka, setMembuka] = useState(false)

  // Detail sesi aktif (yang sedang discan / direview)
  const [detailBaris, setDetailBaris] = useState<BarisRow[]>([])
  const [sesiAktif, setSesiAktif] = useState<SesiRow | null>(null)
  const [scanBarcode, setScanBarcode] = useState('')
  const [scanQty, setScanQty] = useState(1)
  const [pesanScan, setPesanScan] = useState<{ jenis: 'ok' | 'err' | 'warn'; teks: string } | null>(null)
  const [beraksi, setBeraksi] = useState(false)
  const [pesan, setPesan] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  async function muatRiwayat() {
    try {
      const res = await fetch('/api/stock-opname')
      const d = await res.json()
      if (res.ok) setRiwayat(Array.isArray(d) ? d : [])
    } catch { /* biarkan riwayat kosong */ }
  }

  // Muat daftar kategori (utk scope) + riwayat sesi.
  useEffect(() => {
    fetch('/api/kategori').then(r => r.json()).then(setKategori).catch(() => {})
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState memakai .then async di luar, bukan sync
    void muatRiwayat()
  }, [])

  async function bukaSesi() {
    setPesan('')
    if (scope === 'kategori' && !kategoriId) {
      setPesan('Pilih kategori dulu.')
      return
    }
    setMembuka(true)
    try {
      const res = await fetch('/api/stock-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: namaSesi.trim(),
          scope,
          kategori_id: scope === 'kategori' ? kategoriId : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal buka sesi')
      setSesiAktif(d)
      await muatDetail(d.id)
      setScanBarcode('')
      setTimeout(() => scanRef.current?.focus(), 50)
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal buka sesi')
    } finally {
      setMembuka(false)
    }
  }

  async function muatDetail(id: number) {
    try {
      const res = await fetch(`/api/stock-opname/${id}`)
      const d = await res.json()
      if (res.ok) {
        setDetailBaris(d.baris ?? [])
        setSesiAktif(d.sesi)
      }
    } catch { /* biarkan */ }
  }

  async function scan() {
    if (!sesiAktif) return
    const bc = scanBarcode.trim()
    if (!bc) return
    setPesanScan(null)
    try {
      const res = await fetch(`/api/stock-opname/${sesiAktif.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: bc, qty: scanQty }),
      })
      const d = await res.json()
      if (d.flag === 'tak_dikenal') {
        setPesanScan({ jenis: 'warn', teks: d.pesan || `Barcode ${bc} tidak dikenal.` })
      } else if (!res.ok) {
        setPesanScan({ jenis: 'err', teks: d.error || 'Gagal scan' })
      } else {
        setPesanScan({ jenis: 'ok', teks: `Tercatat ${scanQty} × ${d.baris?.nama || bc}` })
        await muatDetail(sesiAktif.id)
      }
      setScanBarcode('')
      scanRef.current?.focus()
    } catch (e) {
      setPesanScan({ jenis: 'err', teks: e instanceof Error ? e.message : 'Gagal scan' })
    }
  }

  async function selesai() {
    if (!sesiAktif || sesiAktif.status !== 'proses') return
    setBeraksi(true); setPesan('')
    try {
      const res = await fetch(`/api/stock-opname/${sesiAktif.id}/selesai`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal menyelesaikan sesi')
      await muatDetail(sesiAktif.id)
      await muatRiwayat()
      setPesan(`Sesi ${d.nomor_so} selesai — ${d.ada_selisih} item selisih, total ${d.total_selisih}. Belum mengubah stok.`)
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal menyelesaikan sesi')
    } finally {
      setBeraksi(false)
    }
  }

  async function approve() {
    if (!sesiAktif || sesiAktif.status !== 'selesai') return
    if (!confirm(`Approve ${sesiAktif.nomor_so}? Stok produk akan disesuaikan dengan hasil fisik.`)) return
    setBeraksi(true); setPesan('')
    try {
      const res = await fetch(`/api/stock-opname/${sesiAktif.id}/approve`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal approve')
      await muatDetail(sesiAktif.id)
      await muatRiwayat()
      setPesan(`Approve ${d.nomor_so}: ${d.terapkan} produk disesuaikan.`)
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal approve')
    } finally {
      setBeraksi(false)
    }
  }

  async function batalkan() {
    if (!sesiAktif || (sesiAktif.status !== 'proses' && sesiAktif.status !== 'selesai')) return
    if (!confirm(`Batalkan sesi ${sesiAktif.nomor_so}? Tidak ada stok yang berubah.`)) return
    setBeraksi(true)
    try {
      const res = await fetch(`/api/stock-opname/${sesiAktif.id}/batal`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal membatalkan')
      await muatDetail(sesiAktif.id)
      await muatRiwayat()
      setPesan('Sesi dibatalkan.')
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal membatalkan')
    } finally {
      setBeraksi(false)
    }
  }

  const selisihKls = (s: number) =>
    s < 0 ? 'text-red-600' : s > 0 ? 'text-green-600' : 'text-gray-400'

  return (
    <div className="p-5 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <ClipboardCheck size={22} className="text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">Stock Opname (Scan Barcode)</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Hitung stok fisik via scan. Sesi disimpan, selisih dihitung — stok produk hanya berubah setelah <b>Approve</b>.
      </p>

      {pesan && (
        <div className="mb-4 text-sm bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl px-4 py-3">{pesan}</div>
      )}

      {/* ==== Buka sesi baru ==== */}
      {!sesiAktif && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Buka Sesi Baru</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Cakupan
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700"
                value={scope}
                onChange={(e) => setScope(e.target.value as 'semua' | 'kategori')}
              >
                <option value="semua">Semua produk</option>
                <option value="kategori">Per kategori</option>
              </select>
            </label>
            {scope === 'kategori' && (
              <label className="flex flex-col gap-1 text-xs text-gray-500">
                Pilih kategori
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 min-w-44"
                  value={kategoriId}
                  onChange={(e) => setKategoriId(Number(e.target.value))}
                >
                  <option value={0}>— pilih —</option>
                  {kategori.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Label opsional
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
                placeholder="mis. Rak A — Minuman"
                value={namaSesi}
                onChange={(e) => setNamaSesi(e.target.value)}
              />
            </label>
            <button
              onClick={bukaSesi}
              disabled={membuka}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <PlayFill size={15} /> {membuka ? 'Membuka...' : 'Buka Sesi'}
            </button>
          </div>
        </div>
      )}

      {/* ==== Sesi aktif: scan ==== */}
      {sesiAktif && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <div className="font-bold text-gray-900">{sesiAktif.nomor_so}</div>
              <div className="text-xs text-gray-400">
                {sesiAktif.nama || 'Tanpa label'} · Cakupan {sesiAktif.scope} · dibuka {fmtTgl(sesiAktif.dibuat_at)}
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[sesiAktif.status].cls}`}>
              {STATUS_BADGE[sesiAktif.status].label}
            </span>
          </div>

          {sesiAktif.status === 'proses' && (
            <>
              <div className="flex gap-2 items-stretch mb-4">
                <input
                  ref={scanRef}
                  className="flex-1 border-2 border-indigo-200 rounded-xl px-4 py-3 text-lg text-gray-800 outline-none focus:border-indigo-500 font-mono"
                  placeholder="Scan barcode produk..."
                  value={scanBarcode}
                  onChange={(e) => setScanBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void scan() }}
                  autoFocus
                />
                <select
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white text-gray-700"
                  value={scanQty}
                  onChange={(e) => setScanQty(Number(e.target.value))}
                >
                  {[1, 2, 3, 5, 10, 20, 50].map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <button
                  onClick={scan}
                  className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <UpcScan size={15} /> Scan
                </button>
              </div>
              {pesanScan && (
                <div className={`mb-3 text-sm rounded-xl px-4 py-2.5 border ${
                  pesanScan.jenis === 'ok' ? 'bg-green-50 text-green-700 border-green-100'
                  : pesanScan.jenis === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-red-50 text-red-600 border-red-100'
                }`}>
                  {pesanScan.teks}
                </div>
              )}
            </>
          )}

          {/* Ringkasan statistik */}
          {detailBaris.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-gray-50 rounded-xl py-3">
                <div className="text-xl font-bold text-gray-800">{detailBaris.length}</div>
                <div className="text-[11px] text-gray-400">item tercatat</div>
              </div>
              <div className="bg-red-50 rounded-xl py-3">
                <div className="text-xl font-bold text-red-600">{detailBaris.filter(b => b.selisih < 0).length}</div>
                <div className="text-[11px] text-gray-400">minus</div>
              </div>
              <div className="bg-green-50 rounded-xl py-3">
                <div className="text-xl font-bold text-green-600">
                  {detailBaris.reduce((a, b) => a + b.selisih, 0)}
                </div>
                <div className="text-[11px] text-gray-400">total selisih</div>
              </div>
            </div>
          )}

          {/* Daftar detail */}
          {detailBaris.length > 0 && (
            <div className="max-h-80 overflow-auto border border-gray-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Nama</th>
                    <th className="text-left px-2 py-2 font-medium">Barcode</th>
                    <th className="text-right px-2 py-2 font-medium">Sistem</th>
                    <th className="text-right px-2 py-2 font-medium">Fisik</th>
                    <th className="text-right px-4 py-2 font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {detailBaris.map((b) => (
                    <tr key={b.produk_id} className="border-t border-gray-50">
                      <td className="px-4 py-2 text-gray-700">{b.nama || '—'}</td>
                      <td className="px-2 py-2 font-mono text-xs text-gray-400">{b.barcode || ''}</td>
                      <td className="px-2 py-2 text-right text-gray-500">{b.stok_sistem}</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-800">{b.stok_fisik}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${selisihKls(b.selisih)}`}>
                        {b.selisih > 0 ? '+' : ''}{b.selisih}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Aksi per status */}
          <div className="mt-4 flex gap-2">
            {sesiAktif.status === 'proses' && (
              <button
                onClick={selesai}
                disabled={beraksi}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Check2Circle size={15} /> {beraksi ? 'Menghitung...' : 'Selesai (hitung selisih)'}
              </button>
            )}
            {sesiAktif.status === 'selesai' && (
              <button
                onClick={approve}
                disabled={beraksi}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Clipboard2Check size={15} /> {beraksi ? 'Menyesuaikan...' : 'Approve & Sesuaikan Stok'}
              </button>
            )}
            {(sesiAktif.status === 'proses' || sesiAktif.status === 'selesai') && (
              <button
                onClick={batalkan}
                disabled={beraksi}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <XCircle size={15} /> Batalkan
              </button>
            )}
            {(sesiAktif.status === 'disetujui' || sesiAktif.status === 'dibatalkan') && (
              <button
                onClick={() => { setSesiAktif(null); setDetailBaris([]) }}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <ArrowCounterclockwise size={15} /> Sesi Baru
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==== Riwayat ==== */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Riwayat SO</h2>
        {riwayat.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada sesi stock opname.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs">
                <tr>
                  <th className="text-left py-2 font-medium">Nomor</th>
                  <th className="text-left py-2 font-medium">Label</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Item</th>
                  <th className="text-right py-2 font-medium">Selisih</th>
                  <th className="text-left py-2 font-medium">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-50 cursor-pointer hover:bg-gray-50"
                    onClick={() => muatDetail(r.id)}
                  >
                    <td className="py-2.5 font-semibold text-gray-800">{r.nomor_so}</td>
                    <td className="py-2.5 text-gray-600">{r.nama || '—'}</td>
                    <td className="py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status].cls}`}>
                        {STATUS_BADGE[r.status].label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-500">{r.jumlah_baris}</td>
                    <td className={`py-2.5 text-right font-semibold ${selisihKls(r.total_selisih)}`}>
                      {r.total_selisih > 0 ? '+' : ''}{r.total_selisih}
                    </td>
                    <td className="py-2.5 text-gray-400">{fmtTgl(r.dibuat_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
