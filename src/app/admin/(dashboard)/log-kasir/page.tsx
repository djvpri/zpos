'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bug, ArrowClockwise, XLg } from 'react-bootstrap-icons'

interface Row {
  id: number
  toko_id: number
  toko_nama: string
  device_id: string
  nama_pc: string | null
  konten: string
  created_at: string
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })
}

export default function AdminLogKasir() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/log-kasir?limit=200')
      if (!res.ok) throw new Error('Gagal memuat log')
      const d = await res.json()
      setRows(Array.isArray(d) ? d : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // setTimeout 0: setState dalam load() sinkron sebelum await pertama —
  // react 19 rule "cascading render" menuntut agar tak setState dalam effect sinkron.
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bug size={20} className="text-rose-500" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Log Error Kasir</h1>
            <p className="text-xs text-gray-400">Upload otomatis dari zpos-errors.log tiap PC kasir — retensi 30 hari</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
        >
          <ArrowClockwise size={15} className={loading ? 'animate-spin' : ''} /> Muat ulang
        </button>
      </div>

      {error && <div className="mb-4 bg-rose-50 text-rose-600 text-sm px-3 py-2 rounded-xl">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-400">
          Belum ada log error dari kasir. Baris muncul otomatis saat PC kasir tersinkron & punya error baru.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {rows.map(r => (
            <button
              key={r.id}
              onClick={() => setDetail(r)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    <span className="text-indigo-600">{r.toko_nama}</span>
                    <span className="text-gray-300 mx-1.5">·</span>
                    <span className="text-gray-600">{r.nama_pc || r.device_id.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{r.konten.slice(0, 120)}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{fmt(r.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal detail isi log */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-900">{detail.toko_nama}</p>
                <p className="text-xs text-gray-400">
                  {detail.nama_pc || '-'} · device {detail.device_id.slice(0, 12)}… · {fmt(detail.created_at)}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700">
                <XLg size={16} />
              </button>
            </div>
            <pre className="px-5 py-4 text-[11px] leading-relaxed text-gray-700 overflow-auto flex-1 whitespace-pre-wrap break-all font-mono">
              {detail.konten}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}