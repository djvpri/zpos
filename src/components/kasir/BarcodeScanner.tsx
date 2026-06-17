'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanLine, X } from 'lucide-react'
import { useZxing } from 'react-zxing'

interface Props {
  onScan: (barcode: string) => void
}

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
            <X size={20} />
          </button>
        </div>
        <div className="relative">
          <video ref={ref} className="w-full aspect-square object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-indigo-400 rounded-xl opacity-80">
              <ScanLine size={24} className="text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
          </div>
        </div>
        <p className="text-white/50 text-xs text-center py-3">Support EAN-13, QR Code, Code 128, dll</p>
      </div>
    </div>
  )
}

// Komponen untuk USB scanner — input tersembunyi yang menangkap scan cepat
export function useBarcodeUsbListener(onScan: (barcode: string) => void) {
  const buffer = useRef('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Abaikan jika focus ada di input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Enter') {
        if (buffer.current.length >= 3) onScan(buffer.current)
        buffer.current = ''
        return
      }

      if (e.key.length === 1) {
        buffer.current += e.key
        if (timer.current) clearTimeout(timer.current)
        // Reset buffer jika tidak ada input baru dalam 100ms (bukan scanner USB)
        timer.current = setTimeout(() => { buffer.current = '' }, 100)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onScan])
}
