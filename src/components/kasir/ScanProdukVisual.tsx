'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, X, RefreshCw, ShoppingCart, CheckCircle, AlertCircle, Pause, Play } from 'lucide-react'
import { cariProdukDariFoto, HasilCari } from '@/lib/zface-visual'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  onPilih: (produkId: number, nama: string, harga: number) => void
  onClose: () => void
}

const DIAM_MS = 1000     // deteksi diam setelah 1 detik
const SCAN_INTERVAL = 2000 // minimal jarak antar auto-scan

export default function ScanProdukVisual({ onPilih, onClose }: Props) {
  const { toko } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const motionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastScanRef = useRef<number>(0)
  const scanningRef = useRef(false)

  const [status, setStatus] = useState<'kamera' | 'proses' | 'hasil' | 'error'>('kamera')
  const [hasil, setHasil] = useState<HasilCari[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [kameraAktif, setKameraAktif] = useState(false)
  const [autoScan, setAutoScan] = useState(true)
  const [diaming, setDiaming] = useState(false)

  const stopKamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setKameraAktif(false)
    if (motionTimerRef.current) clearTimeout(motionTimerRef.current)
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
      setErrorMsg('Tidak bisa akses kamera.')
    }
  }, [])

  // Deteksi gerakan dengan compare frame
  const detectMotion = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const prev = prevCanvasRef.current
    if (!video || !canvas || !prev || video.readyState < 2) return

    const w = 160, h = 120  // resolusi rendah untuk efisiensi
    canvas.width = w; canvas.height = h
    prev.width = w; prev.height = h

    const ctx = canvas.getContext('2d')!
    const prevCtx = prev.getContext('2d')!

    // Simpan frame sebelumnya
    prevCtx.drawImage(canvas, 0, 0)
    // Ambil frame baru
    ctx.drawImage(video, 0, 0, w, h)

    const curr = ctx.getImageData(0, 0, w, h).data
    const prv = prevCtx.getImageData(0, 0, w, h).data

    let diff = 0
    for (let i = 0; i < curr.length; i += 4) {
      diff += Math.abs(curr[i] - prv[i]) + Math.abs(curr[i+1] - prv[i+1]) + Math.abs(curr[i+2] - prv[i+2])
    }
    const avgDiff = diff / (w * h * 3)

    if (avgDiff > 15) {
      // Ada gerakan — reset timer
      setDiaming(false)
      if (motionTimerRef.current) clearTimeout(motionTimerRef.current)
      motionTimerRef.current = setTimeout(() => setDiaming(true), DIAM_MS)
    }
  }, [])

  // Loop deteksi gerakan
  useEffect(() => {
    if (!kameraAktif || status !== 'kamera') return
    const interval = setInterval(detectMotion, 200)
    return () => clearInterval(interval)
  }, [kameraAktif, status, detectMotion])

  // Auto-scan saat diam
  useEffect(() => {
    if (!diaming || !autoScan || status !== 'kamera' || scanningRef.current) return
    const now = Date.now()
    if (now - lastScanRef.current < SCAN_INTERVAL) return
    autoAmbilFoto()
  }, [diaming, autoScan, status])

  useEffect(() => {
    startKamera()
    return () => stopKamera()
  }, [])

  async function ambilFrame(): Promise<Blob | null> {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    if (!video || video.readyState < 2) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    return new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.8))
  }

  async function autoAmbilFoto() {
    if (scanningRef.current || !toko) return
    scanningRef.current = true
    lastScanRef.current = Date.now()
    setStatus('proses')

    try {
      const blob = await ambilFrame()
      if (!blob) { setStatus('kamera'); scanningRef.current = false; return }
      const data = await cariProdukDariFoto({ fotoBlob: blob, tokoId: toko.tokoId })

      if (data.length > 0 && data[0].confidence >= 70) {
        setHasil(data)
        setStatus('hasil')
        stopKamera()
      } else {
        // Confidence rendah — kembali scan
        setStatus('kamera')
        setDiaming(false)
      }
    } catch {
      setStatus('kamera')
      setDiaming(false)
    }
    scanningRef.current = false
  }

  async function manualScan() {
    if (!toko) return
    setStatus('proses')
    try {
      const blob = await ambilFrame()
      if (!blob) { setStatus('error'); setErrorMsg('Gagal ambil frame'); return }
      const data = await cariProdukDariFoto({ fotoBlob: blob, tokoId: toko.tokoId })
      setHasil(data)
      setStatus('hasil')
      stopKamera()
    } catch {
      setStatus('error')
      setErrorMsg('Gagal menghubungi ZFace.')
    }
  }

  function ulangi() {
    setHasil([])
    setDiaming(false)
    scanningRef.current = false
    lastScanRef.current = 0
    setStatus('kamera')
    startKamera()
  }

  function pilihProduk(h: HasilCari) {
    onPilih(Number(h.produk_id), h.nama, h.harga)
    onClose()
  }

  const confidenceColor = (s: string) =>
    s === 'tinggi' ? 'text-green-600 bg-green-50 border-green-200' :
    s === 'sedang' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-red-500 bg-red-50 border-red-200'

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
          <div className="flex items-center gap-2">
            {status === 'kamera' && (
              <button onClick={() => setAutoScan(a => !a)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition border ${autoScan ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {autoScan ? <><Pause size={11} /> Auto</> : <><Play size={11} /> Manual</>}
              </button>
            )}
            <button onClick={() => { stopKamera(); onClose() }}
              className="rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Kamera */}
        {(status === 'kamera' || status === 'proses') && (
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <canvas ref={prevCanvasRef} className="hidden" />

            {/* Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`relative w-52 h-40 transition-all duration-300 ${diaming ? 'scale-95' : 'scale-100'}`}>
                <div className={`absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 rounded-tl transition-colors ${diaming ? 'border-green-400' : 'border-white'}`} />
                <div className={`absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 rounded-tr transition-colors ${diaming ? 'border-green-400' : 'border-white'}`} />
                <div className={`absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 rounded-bl transition-colors ${diaming ? 'border-green-400' : 'border-white'}`} />
                <div className={`absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 rounded-br transition-colors ${diaming ? 'border-green-400' : 'border-white'}`} />
                {diaming && autoScan && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] text-green-400 font-medium bg-black/40 px-2 py-0.5 rounded-full">Mengenali...</span>
                  </div>
                )}
              </div>
            </div>

            {status === 'proses' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Mengenali produk...</p>
                </div>
              </div>
            )}

            {/* Hint */}
            {status === 'kamera' && !diaming && autoScan && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                <span className="text-[10px] text-white/70 bg-black/40 px-3 py-1 rounded-full">
                  Arahkan ke produk, scan otomatis saat kamera diam
                </span>
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
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">Pilih produk yang sesuai:</p>
                {hasil.map((h, i) => (
                  <button key={i} onClick={() => pilihProduk(h)}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${i === 0 && h.status === 'tinggi' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                    {h.foto_url && <img src={h.foto_url} alt={h.nama} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{h.nama}</span>
                        {i === 0 && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-500">Rp {h.harga.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${confidenceColor(h.status)}`}>
                        {h.confidence}%
                      </span>
                      <div className="mt-1"><ShoppingCart size={14} className="text-indigo-500 ml-auto" /></div>
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
            <button onClick={manualScan} disabled={!kameraAktif}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
              <Camera size={18} /> Scan Sekarang
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
