import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import sql from '@/lib/db'

export const revalidate = 300

async function getArtikel(slug: string) {
  const rows = await sql`SELECT judul, slug, deskripsi, tags, konten, published_at FROM artikel WHERE slug = ${slug} LIMIT 1`
  return rows[0] ?? null
}

// Renderer markdown DAPAT dipercaya (konten dari cron sendiri). Mendukung: heading, bold,
// italic, kode, list, link, paragraf. Dipakai utk konten artikel harian otomatis.
function renderMarkdown(md: string): string {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let listOpen = false

  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false } }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { closeList(); continue }

    // list item
    const li = line.match(/^[-*]\s+(.*)/)
    if (li) {
      if (!listOpen) { out.push('<ul>'); listOpen = true }
      out.push(`<li>${esc(inline(li[1]))}</li>`)
      continue
    }

    closeList()

    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      const lvl = h[1].length + 1
      out.push(`<h${lvl}>${esc(inline(h[2]))}</h${lvl}>`)
      continue
    }
    if (line === '---' || /^\*{3,}\s*$/.test(line)) { out.push('<hr/>'); continue }

    out.push(`<p>${esc(inline(line))}</p>`)
  }
  closeList()
  return out.join('\n')
}

function inline(s: string): string {
  // backtick code
  let t = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // bold **x**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // italic *x*
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  // link [t](u)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return t
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await getArtikel(slug)
  return { title: `${a?.judul ?? 'Artikel'} | ZPos`, description: a?.deskripsi ?? undefined }
}

export default async function ArtikelDetail({ params }: Props) {
  const { slug } = await params
  const a = await getArtikel(slug)
  if (!a) notFound()

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">Z</span>
            </div>
            <span className="font-bold text-gray-900">ZPos</span>
          </Link>
          <Link href="/artikel" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
            ← Artikel
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        <div className="text-xs text-gray-400 mb-4">
          {a.published_at
            ? new Date(a.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : ''}
          {(a.tags && a.tags.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.tags.map((t: string) => (
                <span key={t} className="inline-block bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-6">{a.judul}</h1>
        <div
          className="artikel-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(a.konten) }}
        />
      </article>

      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center text-xs text-gray-400">
          <Link href="/artikel" className="hover:text-indigo-600 transition-colors">← Lihat artikel lainnya</Link>
        </div>
      </footer>
    </div>
  )
}
