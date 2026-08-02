import { NextResponse } from 'next/server'
import sql from '@/lib/db'

// GET /api/toko/:subdomain — katalog publik toko online (tanpa auth, read-only).
// Server-render pendamping halaman /toko/:subdomain. Scrub field internal.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params
  if (!subdomain) return NextResponse.json({ error: 'subdomain-wajib' }, { status: 400 })

  const [toko] = await sql`
    SELECT id, nama, subdomain, toko_online_aktif, wa_toko_online
    FROM toko
    WHERE LOWER(subdomain) = LOWER(${subdomain}) AND toko_online_aktif = true
  `
  if (!toko) return NextResponse.json({ error: 'toko-tidak-ditemukan' }, { status: 404 })

  const produk = await sql`
    SELECT p.id, p.nama, p.harga, p.emoji, p.deskripsi, p.stok, p.foto_thumb, k.nama AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.toko_id = ${toko.id} AND p.aktif = true AND p.harga > 0
    ORDER BY p.nama ASC
  `

  const kategori = await sql`
    SELECT DISTINCT k.nama
    FROM produk p
    JOIN kategori k ON k.id = p.kategori_id
    WHERE p.toko_id = ${toko.id} AND p.aktif = true AND p.harga > 0
    ORDER BY k.nama ASC
  `

  return NextResponse.json({
    toko: {
      nama: toko.nama,
      subdomain: toko.subdomain,
      wa: toko.wa_toko_online || null,
    },
    kategori: kategori.map((k) => k.nama).filter(Boolean),
    produk,
  })
}
