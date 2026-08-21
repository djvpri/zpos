import Link from 'next/link'
import type { Metadata } from 'next'
import sql from '@/lib/db'

export const metadata: Metadata = {
  title: 'Artikel & Tips Bisnis | Z1 Pos',
  description: 'Tips mengelola toko, kasir digital, dan UMKM dari Z1 Pos.',
}

export const dynamic = 'force-dynamic'

type ArtikelCard = { judul: string; slug: string; deskripsi: string | null; tags: string[] | null; published_at: Date }

async function getArtikel(): Promise<ArtikelCard[]> {
  try {
    return await sql<ArtikelCard[]>`
      SELECT judul, slug, deskripsi, tags, published_at
      FROM artikel
      ORDER BY published_at DESC
      LIMIT 24
    `
  } catch {
    return []
  }
}

export default async function ArtikelPage() {
  const artikel = await getArtikel()

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">Z</span>
            </div>
            <span className="font-bold text-gray-900">Z1 Pos</span>
          </Link>
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
            ← Kembali
          </Link>
        </div>
      </nav>

      <header className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">Artikel &amp; Tips Bisnis</h1>
        <p className="text-gray-500 text-base sm:text-lg">
          Tips praktis mengelola toko, kasir digital, dan UMKM.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        {artikel.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Belum ada artikel.</p>
            <p className="text-sm mt-1">Artikel baru terbit otomatis setiap hari.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {artikel.map((a) => (
              <Link
                key={a.slug}
                href={`/artikel/${a.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all p-5 sm:p-6 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
                  {a.published_at
                    ? new Date(a.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : ''}
                  {(a.tags && a.tags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {a.tags.slice(0, 3).map((t: string) => (
                        <span key={t} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <h2 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{a.judul}</h2>
                {a.deskripsi && (
                  <p className="text-sm text-gray-500 line-clamp-3">{a.deskripsi}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-xs text-gray-400">
          © 2026 Z1 Pos. Dibuat dengan cinta untuk UMKM Indonesia.
        </div>
      </footer>
    </div>
  )
}
