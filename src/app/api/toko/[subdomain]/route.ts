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
    SELECT id, nama, harga, emoji, deskripsi, stok, foto_thumb, foto_url
    FROM produk
    WHERE toko_id = ${toko.id} AND aktif = true AND harga > 0
    ORDER BY nama ASC
  `

  return NextResponse.json({
    toko: {
      nama: toko.nama,
      subdomain: toko.subdomain,
      wa: toko.wa_toko_online || null,
    },
    produk,
  })
}
