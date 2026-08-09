import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// GET /api/produk/duplikat — daftar pasangan duplikat status 'pending' utk ditinjau.
// Joined nama + harga + foto kedua produk biar UI tampil tanpa query tambahan.
export async function GET(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const kind = url.searchParams.get('status') ?? 'pending'

  const rows = await sql`
    SELECT
      d.id::int AS id,
      d.produk_id_a::int AS a,
      d.produk_id_b::int AS b,
      d.skor,
      d.status,
      pa.nama AS a_nama, pa.harga::int AS a_harga, pa.foto_url AS a_foto,
      pb.nama AS b_nama, pb.harga::int AS b_harga, pb.foto_url AS b_foto
    FROM produk_duplikat d
    JOIN produk pa ON pa.id = d.produk_id_a
    JOIN produk pb ON pb.id = d.produk_id_b
    WHERE d.toko_id = ${auth.tokoId} AND d.status = ${kind}
    ORDER BY d.skor DESC, d.id
    LIMIT 300
  `

  return NextResponse.json({
    pasangan: rows as unknown as {
      id: number; a: number; b: number; skor: number; status: string
      a_nama: string | null; a_harga: number | null; a_foto: string | null
      b_nama: string | null; b_harga: number | null; b_foto: string | null
    }[],
  })
}
