'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Camera, RefreshCw } from 'lucide-react'

interface Props {
  onFoto: (base64: string) => void
  onClose: () => void
}

export default function KameraModal({ onFoto, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState('')
  const [siap, setSiap] = useState(false)

  const stopKamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setSiap(true)
        }
      } catch {
        setError('Tidak bisa akses kamera. Pastikan izin kamera sudah diberikan.')
      }
    }
    start()
    return () => stopKamera()
  }, [stopKamera])

  function ambilFoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    // Kompres ke max 600px
    const maxSize = 600
    const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height, 1)
    const out = document.createElement('canvas')
    out.width = Math.round(canvas.width * scale)
    out.height = Math.round(canvas.height * scale)
    out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height)
    const base64 = out.toDataURL('image/jpeg', 0.8)
    stopKamera()
    onFoto(base64)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/90 sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) { stopKamera(); onClose() } }}>
      <div className="w-full max-w-sm rounded-t-2xl bg-gray-900 overflow-hidden sm:rounded-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white">Foto Produk</span>
          <button onClick={() => { stopKamera(); onClose() }}
            className="rounded-full bg-gray-700 p-1.5 text-gray-300 hover:bg-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          {!siap && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <Camera size={32} className="mx-auto mb-2 text-gray-500" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Crosshair */}
          {siap && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
              </div>
            </div>
          )}
        </div>

        {/* Tombol */}
        <div className="flex gap-3 p-4">
          <button onClick={() => { stopKamera(); onClose() }}
            className="flex-1 rounded-xl border border-gray-600 py-3 text-sm text-gray-300 hover:bg-gray-800 transition">
            Batal
          </button>
          <button onClick={ambilFoto} disabled={!siap}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            <Camera size={16} /> Ambil Foto
          </button>
        </div>
      </div>
    </div>
  )
}
