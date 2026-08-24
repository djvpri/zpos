'use client'

import { useState } from 'react'
import { Stars, ArrowClockwise } from 'react-bootstrap-icons'

interface HasilAI {
  arahan: string
  error?: string
}

export default function AIPage() {
  const [hasil, setHasil] = useState<HasilAI | null>(null)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')

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
        setPesan('Analisis sudah diperbarui. Datanya 30 hari terakhir.')
      }
    } catch {
      setHasil({ arahan: '', error: 'Gagal memuat analisis. Periksa koneksi.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Stars size={18} className="text-indigo-500" />
          Asisten AI
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Arahan & saran bisnis otomatis dari transaksi Anda (30 hari terakhir).
        </p>
      </div>

      <button
        onClick={analisis}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 mb-6"
      >
        <ArrowClockwise size={15} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Menganalisis...' : hasil ? 'Analisis Ulang' : 'Analisis Bisnis'}
      </button>

      {pesan && <div className="text-sm text-green-700 bg-green-50 px-3 py-2.5 rounded-xl mb-4">{pesan}</div>}

      {hasil?.error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl mb-4">{hasil.error}</div>
      )}

      {hasil?.arahan && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Rekomendasi untuk toko Anda
          </div>
          <div className="prose-a:text-indigo-600 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {hasil.arahan}
          </div>
        </div>
      )}

      {!hasil && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="text-sm text-gray-500 leading-relaxed">
            Klik <b>Analisis Bisnis</b> untuk melihat saran tentang produk terlaris,
            stok yang perlu segera diisi ulang, kandidat diskon, serta jam operasional
            paling sibuk — berdasarkan transaksi toko Anda.
          </div>
        </div>
      )}
    </div>
  )
}
