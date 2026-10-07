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

interface Stats {
  total_7d: number
  err_24h: number
  active_devices: number
  active_tenants: number
}

interface Device {
  device_id: string
  nama_pc: string | null
  toko_id: number
  toko_nama: string
  total: number
  gagal: number
  ok: number
  last_seen: string
  first_seen: string
  wifi_name: string | null
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })
}
const fmtShort = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

// Klasifikasi severity baris log dari prefix konten
function sev(konten: string): 'ERR' | 'DIAG' | 'OK' | 'INFO' {
  if (/sync GAGAL/i.test(konten)) return 'ERR'
  if (/DIAG/i.test(konten)) return 'DIAG'
  if (/sync OK|push.*OK|setup OK|BUKA_LACI_OK/i.test(konten)) return 'OK'
  return 'INFO'
}
const sevColor: Record<string, string> = {
  ERR: 'text-rose-600 bg-rose-50',
  DIAG: 'text-amber-600 bg-amber-50',
  OK: 'text-emerald-600 bg-emerald-50',
  INFO: 'text-indigo-600 bg-indigo-50',
}
// Ambil baris terpendek yang punya substansi (skip header timestamp-only)
function preview(konten: string): string {
  const lines = konten.split('\n').filter(l => l.trim())
  // cari baris dengan kata kunci penting dulu
  const key = lines.find(l => /GAGAL|DIAG|error|panic|Failed/i.test(l))
  if (key) return key.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \| /, '').slice(0, 120)
  return (lines[0] || '').replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \| /, '').slice(0, 120)
}

export default function AdminLogKasir() {
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)
  const [filterToko, setFilterToko] = useState('')
  const [filterSev, setFilterSev] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/log-kasir?limit=200')
      if (!res.ok) throw new Error('Gagal memuat log')
      const d = await res.json()
      setRows(Array.isArray(d.rows) ? d.rows : [])
      setStats(d.stats ?? null)
      setDevices(Array.isArray(d.devices) ? d.devices : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const filtered = rows.filter(r => {
    if (filterToko && String(r.toko_id) !== filterToko) return false
    if (filterSev && sev(r.konten) !== filterSev) return false
    return true
  })

  // online = aktif dalam 24 jam
  const now = Date.now()
  const isOnline = (d: Device) => d.last_seen && (now - new Date(d.last_seen).getTime()) < 24 * 60 * 60 * 1000
  const onlineCount = devices.filter(isOnline).length
  const offlineCount = devices.length - onlineCount

  // urut device: online dulu (last_seen DESC), lalu offline
  const sortedDevices = [...devices].sort((a, b) => {
    const ao = isOnline(a), bo = isOnline(b)
    if (ao && !bo) return -1
    if (!ao && bo) return 1
    return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
  })

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0,1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0,1,2].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-1">Total Log 7 Hari</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_7d.toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-300 mt-1">retensi 30 hari</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-1">Device Kasir</p>
                <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs">
                  {onlineCount > 0 && <span className="text-emerald-600">{onlineCount} online</span>}
                  {offlineCount > 0 && <span className="text-gray-400">· {offlineCount} offline</span>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-1">Error 24 Jam</p>
                <p className={`text-2xl font-bold ${stats.err_24h > 0 ? 'text-rose-500' : 'text-gray-900'}`}>
                  {stats.err_24h}
                </p>
                {devices.find(d => d.gagal > 0) && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {devices.find(d => d.gagal > 0)?.toko_nama}
                    {devices.find(d => d.gagal > 0)?.wifi_name ? ` · ${devices.find(d => d.gagal > 0)?.wifi_name}` : ''}
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-1">Tenant Aktif</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_tenants}</p>
                <p className="text-xs text-gray-300 mt-1 truncate">
                  {devices.map(d => d.toko_nama).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
                </p>
              </div>
            </div>
          )}

          {/* Device health cards */}
          {sortedDevices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {sortedDevices.map(d => {
                const total = d.gagal + d.ok
                const gagalPct = total > 0 ? (d.gagal / total) * 100 : 0
                const okPct = total > 0 ? (d.ok / total) * 100 : 0
                const online = isOnline(d)
                const isErr = d.gagal > 0
                return (
                  <div
                    key={d.device_id + '-' + d.toko_id}
                    className={`bg-white rounded-2xl border p-4 ${isErr ? 'border-2 border-rose-200' : 'border border-gray-100'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{d.toko_nama}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">
                          {d.device_id.slice(0, 8)}… · {d.nama_pc || '-'}
                        </p>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          online
                            ? isErr
                              ? 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.2)]'
                              : 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]'
                            : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">30 hari</span>
                        <span>
                          {d.gagal > 0 && <span className="text-rose-500 font-medium">{d.gagal} GAGAL</span>}
                          {d.gagal > 0 && d.ok > 0 && <span className="text-gray-300"> · </span>}
                          {d.ok > 0 && <span className="text-emerald-600 font-medium">{d.ok} OK</span>}
                          {d.gagal === 0 && d.ok === 0 && <span className="text-gray-400">{d.total} baris</span>}
                        </span>
                      </div>
                      {total > 0 ? (
                        <div className="flex gap-0.5 h-1.5">
                          {gagalPct > 0 && (
                            <div className="bg-rose-500 rounded-l" style={{ flexGrow: d.gagal }} />
                          )}
                          {okPct > 0 && (
                            <div
                              className={`bg-emerald-500 ${gagalPct === 0 ? 'rounded-l' : ''} rounded-r`}
                              style={{ flexGrow: d.ok }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-0.5 h-1.5">
                          <div className="flex-1 bg-gray-200 rounded" />
                        </div>
                      )}
                      <p className={`text-xs ${isErr && online ? 'text-rose-500' : 'text-gray-400'}`}>
                        {isErr && online && d.wifi_name
                          ? `WiFi: ${d.wifi_name} · intermittent`
                          : online
                            ? `Terakhir: ${fmtShort(d.last_seen)}`
                            : `Offline sejak ${fmtShort(d.last_seen)}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Log list */}
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Log Terbaru</h2>
                <span className="text-xs text-gray-400">{filtered.length} baris</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterToko}
                  onChange={e => setFilterToko(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600"
                >
                  <option value="">Semua tenant</option>
                  {devices.map(d => (
                    <option key={d.toko_id} value={String(d.toko_id)}>{d.toko_nama}</option>
                  ))}
                </select>
                <select
                  value={filterSev}
                  onChange={e => setFilterSev(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600"
                >
                  <option value="">Semua severity</option>
                  <option value="ERR">Error</option>
                  <option value="DIAG">Diagnosa</option>
                  <option value="OK">OK</option>
                  <option value="INFO">Info</option>
                </select>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">
                Tidak ada log sesuai filter.
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {filtered.map(r => {
                  const s = sev(r.konten)
                  return (
                    <button
                      key={r.id}
                      onClick={() => setDetail(r)}
                      className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevColor[s]}`}>{s}</span>
                            <span className="text-sm font-medium text-indigo-600">{r.toko_nama}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-500">{r.nama_pc || r.device_id.slice(0, 8)}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate font-mono">{preview(r.konten)}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{fmtShort(r.created_at)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
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
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevColor[sev(detail.konten)]}`}>
                    {sev(detail.konten)}
                  </span>
                  <p className="text-sm font-semibold text-gray-900">{detail.toko_nama}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
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
