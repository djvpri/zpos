import sql from '@/lib/db'
import { TokoOnlineClient } from './TokoOnlineClient'

// Halaman katalog publik toko online: /toko/:subdomain (dev path).
// Saat DNS *.zpos.my.id siap, pindah ke subdomain beneran — konten render sama.
export default async function TokoOnlinePage({
  params,
}: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params

  const [toko] = await sql`
    SELECT id, nama, subdomain, toko_online_aktif, wa_toko_online
    FROM toko
    WHERE LOWER(subdomain) = LOWER(${subdomain}) AND toko_online_aktif = true
  `
  if (!toko) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-xl font-semibold text-gray-700">Toko tidak ditemukan</h1>
          <p className="text-sm text-gray-500 mt-2">Toko online ini belum aktif atau subdomain salah.</p>
        </div>
      </main>
    )
  }

  const produk = await sql`
    SELECT p.id, p.nama, p.harga, p.emoji, p.deskripsi, p.stok, p.foto_url, k.nama AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.toko_id = ${toko.id} AND p.aktif = true AND p.harga > 0
    ORDER BY p.nama ASC
  `

  const kategoriListe = await sql`
    SELECT DISTINCT k.nama
    FROM produk p
    JOIN kategori k ON k.id = p.kategori_id
    WHERE p.toko_id = ${toko.id} AND p.aktif = true AND p.harga > 0
    ORDER BY k.nama ASC
  `

  const items = produk.map((p) => ({
    id: p.id,
    nama: p.nama,
    harga: Number(p.harga),
    emoji: p.emoji,
    deskripsi: p.deskripsi ?? undefined,
    stok: Number(p.stok),
    foto: p.foto_url ?? null,
    kategori: p.kategori ?? undefined,
  }))

  return (
    <TokoOnlineClient
      namaToko={toko.nama}
      waToko={toko.wa_toko_online}
      produk={items}
      kategori={kategoriListe.map((k) => k.nama).filter(Boolean)}
    />
  )
}
