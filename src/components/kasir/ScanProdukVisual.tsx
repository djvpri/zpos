'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, X, RefreshCw, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react'
import { cariProdukDariFoto, HasilCari } from '@/lib/zface-visual'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  onPilih: (produkId: number, nama: string, harga: number) => void
  onClose: () => void
}

export default function ScanProdukVisual({ onPilih, onClose }: Props) {
  const { toko } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'kamera' | 'proses' | 'hasil' | 'error'>('kamera')
  const [hasil, setHasil] = useState<HasilCari[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [kameraAktif, setKameraAktif] = useState(false)

  const stopKamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setKameraAktif(false)
  }, [])

  const startKamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setKameraAktif(true)
      }
    } catch {
      setStatus('error')
      setErrorMsg('Tidak bisa akses kamera. Pastikan izin kamera sudah diberikan.')
    }
  }, [])

  useEffect(() => {
    startKamera()
    return () => stopKamera()
  }, [])

  async function ambilFoto() {
    if (!videoRef.current || !canvasRef.current || !toko) return
    setStatus('proses')

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) { setStatus('error'); setErrorMsg('Gagal ambil foto'); return }
      try {
        const data = await cariProdukDariFoto({ fotoBlob: blob, tokoId: toko.tokoId })
        setHasil(data)
        setStatus('hasil')
        stopKamera()
      } catch {
        setStatus('error')
        setErrorMsg('Gagal menghubungi ZFace. Coba lagi.')
      }
    }, 'image/jpeg', 0.85)
  }

  function ulangi() {
    setHasil([])
    setStatus('kamera')
    startKamera()
  }

  function pilihProduk(h: HasilCari) {
    onPilih(Number(h.produk_id), h.nama, h.harga)
    onClose()
  }

  const confidenceColor = (s: string) =>
    s === 'tinggi' ? 'text-green-600 bg-green-50' :
    s === 'sedang' ? 'text-yellow-600 bg-yellow-50' :
    'text-red-500 bg-red-50'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) { stopKamera(); onClose() } }}>
      <div className="w-full max-w-sm rounded-t-2xl bg-white sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-indigo-600" />
            <span className="text-sm font-semibold text-gray-800">Scan Produk Visual</span>
          </div>
          <button onClick={() => { stopKamera(); onClose() }}
            className="rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Kamera */}
        {(status === 'kamera' || status === 'proses') && (
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-44">
                <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-white rounded-tl" />
                <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-white rounded-br" />
              </div>
            </div>

            {status === 'proses' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center text-white">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Mengenali produk...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hasil */}
        {status === 'hasil' && (
          <div className="p-4">
            {hasil.length === 0 ? (
              <div className="py-6 text-center">
                <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">Produk tidak ditemukan</p>
                <p className="text-xs text-gray-400 mt-1">Pastikan foto produk sudah diupload di menu Produk</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hasil.map((h, i) => (
                  <button key={i} onClick={() => pilihProduk(h)}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${i === 0 && h.status === 'tinggi' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                    {h.foto_url && (
                      <img src={h.foto_url} alt={h.nama} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{h.nama}</span>
                        {i === 0 && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-500">Rp {h.harga.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${confidenceColor(h.status)}`}>
                        {h.confidence}%
                      </span>
                      <div className="mt-1">
                        <ShoppingCart size={14} className="text-indigo-500 ml-auto" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="p-6 text-center">
            <AlertCircle size={32} className="mx-auto mb-2 text-red-400" />
            <p className="text-sm text-red-600 mb-1">Terjadi Kesalahan</p>
            <p className="text-xs text-gray-500">{errorMsg}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-100">
          {status === 'kamera' && (
            <button onClick={ambilFoto} disabled={!kameraAktif}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
              <Camera size={18} /> Ambil Foto & Cari
            </button>
          )}
          {(status === 'hasil' || status === 'error') && (
            <button onClick={ulangi}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 transition">
              <RefreshCw size={16} /> Coba Lagi
            </button>
          )}
          <button onClick={() => { stopKamera(); onClose() }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 transition">
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
