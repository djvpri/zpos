'use client'

import { useEffect, useState } from 'react'
import { Produk } from '@/types'
import { XLg } from 'react-bootstrap-icons'

// Lightbox foto produk: klik thumb (halaman manajemen produk) → tampilkan
// foto ukuran penuh (foto_url) di overlay gelap. Foto penuh sengaja TIDAK
// dikirim di list produk (berat), jadi di-fetch on-demand lewat GET
// /api/produk/:id hanya saat lightbox terbuka.
export default function FotoLightbox({ produk, onTutup }: { produk: Produk; onTutup: () => void }) {
  const [foto, setFoto] = useState<string | null>(produk.foto_thumb ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!produk.foto_url) {
      // List produk tak bawa foto_url — ambil lengkap dari server.
      globalThis.fetch(`/api/produk/${produk.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(p => { if (p?.foto_url) setFoto(p.foto_url); else setError(!produk.foto_thumb) })
        .catch(() => { if (!produk.foto_thumb) setError(true) })
    }
  }, [produk.id, produk.foto_url, produk.foto_thumb])

  // Tutup saat tekan Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onTutup}
    >
      <button
        onClick={onTutup}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
        aria-label="Tutup"
      >
        <XLg size={24} />
      </button>
      <div className="max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-3 min-h-[60vh] items-center">
          {error ? (
            <p className="text-white/60 text-sm">Belum ada foto produk ini</p>
          ) : foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={foto}
              alt={produk.nama}
              onClick={onTutup}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl cursor-zoom-out"
            />
          ) : (
            <div className="text-white/60 animate-pulse">Memuat foto...</div>
          )}
        </div>
        <div className="text-center text-white font-medium">{produk.nama}</div>
      </div>
    </div>
  )
}
