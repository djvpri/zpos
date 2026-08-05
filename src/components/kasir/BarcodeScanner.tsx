'use client'

import { useEffect, useRef, useState } from 'react'
import { QrCodeScan, XLg } from 'react-bootstrap-icons'
import { useZxing } from 'react-zxing'

export function BarcodeCameraModal({ onScan, onTutup }: { onScan: (b: string) => void; onTutup: () => void }) {
  const [last, setLast] = useState('')

  const { ref } = useZxing({
    onDecodeResult(result) {
      const text = result.rawValue
      if (text && text !== last) {
        setLast(text)
        onScan(text)
        onTutup()
      }
    },
  })

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-black rounded-2xl overflow-hidden relative">
        <div className="flex items-center justify-between px-4 py-3 bg-black/60">
          <span className="text-white text-sm font-medium">Arahkan kamera ke barcode</span>
          <button onClick={onTutup} className="p-1 text-white/70 hover:text-white">
            <XLg size={20} />
          </button>
        </div>
        <div className="relative">
          <video ref={ref} className="w-full aspect-square object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-indigo-400 rounded-xl opacity-80">
              <QrCodeScan size={24} className="text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
          </div>
        </div>
        <p className="text-white/50 text-xs text-center py-3">Support EAN-13, QR Code, Code 128, dll</p>
      </div>
    </div>
  )
}

// Komponen untuk USB scanner — input tersembunyi yang menangkap scan cepat.
// Upgrade Langkah B: tak lagi skip saat focus di input. Scanner USB (pola ketik
// kencang + Enter) ditangkap walau cursor di field cari/nama; preventDefault di
// Enter agar barcode TIDAK ikut "ketik" ke field biasa. Hanya field bertanda
// data-scanner="barcode" yang dibiarkan menerima ketikan native (isi field barcode).
export function useBarcodeUsbListener(onScan: (barcode: string) => void) {
  const buffer = useRef('')
  const lastTime = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      // Field barcode yang memang mau diisi native → biarkan (jangan preventDefault).
      const isBarcodeField = (e.target as HTMLElement)?.dataset?.scanner === 'barcode'

      if (e.key === 'Enter') {
        const now = performance.now()
        // Deteksi pola scanner: buffer >= 3 char, dan ketikan kencang (bukan manual).
        const fast = !timer.current || buffer.current.split('').length >= 3
        if (buffer.current.length >= 3 && fast) {
          const code = buffer.current
          buffer.current = ''
          // Kalau focus di input biasa (cari/nama) → biarkan field tak terisi barcode,
          // langsung emit sebagai scan global. Field barcode → native sudah ketik+Enter.
          if (inField && !isBarcodeField) e.preventDefault()
          onScan(code)
        } else {
          buffer.current = ''
        }
        lastTime.current = now
        return
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Jika sedang focus di field barcode, biarkan native (bukan tangkap manual).
        if (inField && isBarcodeField) return
        buffer.current += e.key
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { buffer.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onScan])
}
