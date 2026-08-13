'use client'

import { useState } from 'react'

const SHORTS_ID = '7FfJDK-oFzo'

export default function ShortsWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Putar video singkat"
        className="fixed bottom-6 left-6 z-50 inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold text-sm px-4 py-2.5 rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        Promo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Video promo"
        >
          <div className="relative w-full max-w-[320px] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/20 text-white text-lg leading-none flex items-center justify-center hover:bg-white/35 transition-colors"
            >
              &times;
            </button>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${SHORTS_ID}`}
              title="Video promo ZPos"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0 block"
            />
          </div>
        </div>
      )}
    </>
  )
}
