'use client'

import { useState, type ReactNode } from 'react'
import { Stars, ArrowClockwise, ClockHistory } from 'react-bootstrap-icons'

interface Ringkasan {
  jumlahTransaksi?: number
  totalPenjualan?: number
  produkTerlaris?: { nama: string; qty: number; total: number }[]
  stokMenipis?: { nama: string; stok: number; qty: number }[]
  takLaku?: { nama: string; stok: number }[]
  jamSibuk?: { jam: number; jual: number }[]
}

interface HasilAI {
  arahan: string
  error?: string
  sudah?: boolean
  ringkasan?: Ringkasan
}

interface RiwayatItem {
  id: number
  dibuat: string
  arahan: string
  ringkasan: Ringkasan | null
}

// Render markdown MINIMAL dari output Gemini — bold `**…**` & bullet `- `/`* `.
// Output AI kita terbatas, jadi parser kecil cukup; tak perlu dependensi penuh.
function inlineBold(s: string) {
  return s.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  )
}

function renderAI(arahan: string) {
  const lines = arahan.replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
  let ul: string[] = []
  let key = 0
  const flushUl = () => {
    if (ul.length) {
      out.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1">
          {ul.map((li, i) => <li key={i}>{inlineBold(li)}</li>)}
        </ul>
      )
      ul = []
    }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushUl(); continue }
    const bullet = line.match(/^[-*]\s+(.+)/)
    if (bullet) { ul.push(bullet[1]); continue }
    flushUl()
    const onlyBold = /^\*\*(.+?)\*\*$/.test(line)
    if (onlyBold) {
      out.push(
        <div key={key++} className="font-semibold text-gray-900 mt-4 mb-1 text-[13px]">{inlineBold(line)}</div>
      )
    } else {
      out.push(<p key={key++} className="my-1.5">{inlineBold(line)}</p>)
    }
  }
  flushUl()
  return out
}

const fmtRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function fmtTgl(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AIPage() {
  const [hasil, setHasil] = useState<HasilAI | null>(null)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]) // null = modal tertutup
  const [tampilRiwayat, setTampilRiwayat] = useState(false)
  const [riwayatOpen, setRiwayatOpen] = useState<RiwayatItem | null>(null)

  const analisis = async () => {
    setLoading(true)
    setPesan('')
    try {
      const r = await fetch('/api/ai/bisnis')
      const d = await r.json()
      if (!r.ok) {
        setHasil({ arahan: '', error: d.error || 'Gagal memuat analisis.' })
      } else {
        setHasil(d as HasilAI)
        setPesan(d.sudah
          ? 'Analisis hari ini sudah pernah dibuat. Ini hasilnya (batas 1x/hari).'
          : 'Analisis baru tersimpan. Datanya 30 hari terakhir.')
      }
    } catch {
      setHasil({ arahan: '', error: 'Gagal memuat analisis. Periksa koneksi.' })
    } finally {
      setLoading(false)
    }
  }

  const bukaRiwayat = async () => {
    setTampilRiwayat(true)
    setRiwayatOpen(null)
    try {
      const r = await fetch('/api/ai/bisnis/riwayat')
      const d = await r.json()
      setRiwayat(d.riwayat || [])
    } catch {
      setRiwayat([])
    }
  }

  const r = hasil?.ringkasan

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Stars size={18} className="text-indigo-500" />
            Asisten AI
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Arahan & saran bisnis dari transaksi Anda (30 hari terakhir). Maksimal 1x analisis per hari.
          </p>
        </div>
        <button
          onClick={bukaRiwayat}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ClockHistory size={15} />
          Riwayat
        </button>
      </div>

      {!hasil && !loading && (
        <button
          onClick={analisis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 mb-6"
        >
          <ArrowClockwise size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Menganalisis...' : 'Analisis Bisnis'}
        </button>
      )}

      {hasil && (
        <button
          onClick={analisis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-200 transition-colors disabled:opacity-60 mb-6"
        >
          <ArrowClockwise size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Menganalisis...' : 'Muat Ulang Analisis Hari Ini'}
        </button>
      )}

      {pesan && (
        <div className={`text-sm px-3 py-2.5 rounded-xl mb-4 ${hasil?.sudah ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
          {pesan}
        </div>
      )}

      {hasil?.error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl mb-4">{hasil.error}</div>
      )}

      {r && !hasil?.error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Omzet 30 hari</div>
            <div className="text-base font-semibold text-gray-900">{fmtRp(Number(r.totalPenjualan ?? 0))}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Transaksi</div>
            <div className="text-base font-semibold text-gray-900">{r.jumlahTransaksi ?? 0}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Jam tersibuk</div>
            <div className="text-base font-semibold text-gray-900">
              {(r.jamSibuk && r.jamSibuk.length ? ((r.jamSibuk[0].jam + 7) % 24) : '-')} WIB
            </div>
          </div>
        </div>
      )}

      {hasil?.arahan && !hasil?.error && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Rekomendasi untuk toko Anda
          </div>
          <div className="text-sm text-gray-700 leading-relaxed">{renderAI(hasil.arahan)}</div>
        </div>
      )}

      {!hasil && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="text-sm text-gray-500 leading-relaxed">
            Klik <b>Analisis Bisnis</b> untuk melihat saran tentang produk terlaris,
            stok yang perlu segera diisi ulang, kandidat diskon, serta jam operasional
            paling sibuk — berdasarkan transaksi toko Anda. Analisis baru tersedia 1x
            per hari; hasilnya tersimpan di riwayat.
          </div>
        </div>
      )}

      {/* Modal Riwayat */}
      {tampilRiwayat && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTampilRiwayat(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Riwayat Analisis AI</div>
              <button onClick={() => setTampilRiwayat(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>

            {riwayatOpen ? (
              <div className="p-5 overflow-y-auto">
                <button onClick={() => setRiwayatOpen(null)} className="text-sm text-indigo-600 mb-3 flex items-center gap-1">
                  &larr; Kembali ke daftar
                </button>
                <div className="text-xs text-gray-400 mb-3">{fmtTgl(riwayatOpen.dibuat)}</div>
                <div className="text-sm text-gray-700 leading-relaxed">{renderAI(riwayatOpen.arahan)}</div>
              </div>
            ) : (
              <div className="overflow-y-auto p-2">
                {riwayat.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-8">Belum ada riwayat.</div>
                ) : (
                  riwayat.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setRiwayatOpen(item)}
                      className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800">{fmtTgl(item.dibuat)}</div>
                        {item.ringkasan && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Omzet {fmtRp(Number(item.ringkasan.totalPenjualan ?? 0))} · {item.ringkasan.jumlahTransaksi ?? 0} transaksi
                          </div>
                        )}
                      </div>
                      <span className="text-gray-300">&rsaquo;</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
