'use client'

import { useState, useEffect, useCallback } from 'react'
import { useKategori } from '@/hooks/useKategori'
import { Search, CheckCircleFill, XCircleFill, Trash, HourglassSplit, ExclamationTriangle } from 'react-bootstrap-icons'

interface Pasangan {
  id: number; a: number; b: number; skor: number; status: string
  a_nama: string | null; a_harga: number | null; a_foto: string | null
  b_nama: string | null; b_harga: number | null; b_foto: string | null
}

// Panel "Deteksi Duplikat": scan foto produk per kategori via ZFace, tampilkan
// pasangan yang confidence-nya tinggi, lalu admin menandai 'sama'/'bukan'.
export default function CekDuplikatPanel({
  hapusProduk,
}: { hapusProduk: (id: number) => Promise<unknown> }) {
  const { kategori } = useKategori()
  const [idKat, setIdKat] = useState<number | ''>('')
  const [pasangan, setPasangan] = useState<Pasangan[]>([])
  const [scanning, setScanning] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const ambil = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/produk/duplikat?status=pending', { cache: 'no-store' })
      if (res.ok) setPasangan(await res.json().then(d => d.pasangan || []))
    } finally { setLoading(false) }
  }, [])

  // Muat pasangan pending saat panel terbuka.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState di dalam async fetch (setelah await), bukan sinkron; fetch-on-mount sah.
  useEffect(() => { ambil() }, [ambil])

  const scan = async () => {
    setScanning(true)
    setPasangan([])
    setPesan(null)
    try {
      const res = await fetch('/api/produk/cek-duplikat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori_id: idKat === '' ? null : idKat }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) setPesan({ tipe: 'ok', teks: `Scan selesai: ${d.diproses} produk, ${d.pasangan_baru ?? d.pasanganBaru} duplikat baru ditemukan.` })
      else setPesan({ tipe: 'err', teks: d.error || `Gagal scan (${res.status})` })
    } catch {
      setPesan({ tipe: 'err', teks: 'Gagal terhubung ke server saat scan.' })
    } finally {
      setScanning(false)
      ambil()
    }
  }

  const tandai = async (id: number, status: 'sama' | 'bukan') => {
    await fetch(`/api/produk/duplikat/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setPasangan(prev => prev.filter(p => p.id !== id))
  }

  const hapusB = async (p: Pasangan) => {
    if (!window.confirm(`Hapus produk "${p.b_nama}"? (duplikat dari "${p.a_nama}")`)) return
    await hapusProduk(p.b)
    await tandai(p.id, 'sama')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={idKat}
          onChange={e => setIdKat(e.target.value === '' ? '' : Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Semua kategori</option>
          {kategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>
        <button
          onClick={scan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {scanning ? <HourglassSplit className="animate-pulse" size={16} /> : <Search size={16} />}
          {scanning ? 'Memindai...' : 'Pindai Duplikat'}
        </button>
        <span className="text-xs text-gray-400">
          ZFace memindai foto produk di kategori ini utk cari yang mirip (duplikat potensial).
        </span>
      </div>

      {pesan && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${pesan.tipe === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <ExclamationTriangle size={16} /> {pesan.teks}
        </div>
      )}

      {loading && <div className="text-sm text-gray-400">Memuat hasil...</div>}

      {pasangan.length === 0 && !loading && !scanning ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          Belum ada pasangan duplikat untuk ditinjau. Klik &quot;Pindai Duplikat&quot; di atas.
        </div>
      ) : (
        <div className="space-y-2">
          {pasangan.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
              <img src={p.a_foto || ''} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{p.a_nama}</div>
                <div className="text-xs text-gray-400">Harga {p.a_harga !== null ? `Rp${p.a_harga.toLocaleString('id-ID')}` : '-'}</div>
              </div>
              <span className="text-gray-300 shrink-0">≈ {Math.round(p.skor * 100)}%</span>
              <img src={p.b_foto || ''} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{p.b_nama}</div>
                <div className="text-xs text-gray-400">Harga {p.b_harga !== null ? `Rp${p.b_harga.toLocaleString('id-ID')}` : '-'}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => tandai(p.id, 'sama')}
                  title="Ini duplikat"
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                ><CheckCircleFill size={18} /></button>
                <button
                  onClick={() => hapusB(p)}
                  title="Hapus produk kanan"
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                ><Trash size={16} /></button>
                <button
                  onClick={() => tandai(p.id, 'bukan')}
                  title="Bukan duplikat"
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                ><XCircleFill size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
