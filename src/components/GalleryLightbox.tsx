'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'react-bootstrap-icons'

type GalleryItem = { src: string; title: string; desc: string }

export default function GalleryLightbox({ items }: { items: GalleryItem[] }) {
  const [idx, setIdx] = useState<number | null>(null)
  const open = idx !== null

  const close = useCallback(() => setIdx(null), [])
  const prev = useCallback(() => setIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length)), [items.length])
  const next = useCallback(() => setIdx((i) => (i === null ? null : (i + 1) % items.length)), [items.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close, prev, next])

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className="group bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all overflow-hidden flex flex-col text-left cursor-pointer"
          >
            <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.title} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="font-bold text-gray-900 mb-1.5 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          {/* Close */}
          <button
            type="button"
            onClick={close}
            aria-label="Tutup"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white transition-colors"
          >
            <X size={22} />
          </button>

          {/* Prev */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev() }}
              aria-label="Sebelumnya"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white transition-colors"
            >
              <ChevronLeft size={26} />
            </button>
          )}

          {/* Next */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next() }}
              aria-label="Berikutnya"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white transition-colors"
            >
              <ChevronRight size={26} />
            </button>
          )}

          {/* Image + caption */}
          <div
            className="flex flex-col items-center max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[idx!].src}
              alt={items[idx!].title}
              className="max-w-full max-h-[78vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="mt-3 text-center px-4">
              <h3 className="text-white font-bold text-base sm:text-lg">{items[idx!].title}</h3>
              <p className="text-white/70 text-sm mt-0.5 max-w-xl">{items[idx!].desc}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
