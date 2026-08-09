import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { cariPasanganDuplikat } from '@/lib/duplikat-foto'

const CONCURRENCY = 3 // request ZFace paralel — batas biar gak nyerang rate-limit AI

// Scan foto produk mirip per toko (opsional per kategori). Untuk tiap produk
// ber-foto, tanya ZFace produk lain yang embedding-nya dekat (duplikat potensial).
// Hasil disimpan ke tabel produk_duplikat status 'pending' untuk ditinjau admin.
export async function POST(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await statusToko(auth.tokoId)
  if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan.' }, { status: 403 })

  let body: { kategori_id?: number | null; max?: number } = {}
  try { body = await req.json() } catch { /* biarkan default */ }
  const kategoriId = body.kategori_id ?? null
  const max = Math.min(body.max && body.max > 0 ? body.max : 500, 2000)

  // Produk target: yg punya foto_url (embedding ZFace), filter kategori opsional.
  const rows = kategoriId
    ? await sql`SELECT id::int AS id, foto_url FROM produk WHERE toko_id = ${auth.tokoId} AND kategori_id = ${kategoriId} AND foto_url IS NOT NULL AND foto_url <> '' ORDER BY id LIMIT ${max}`
    : await sql`SELECT id::int AS id, foto_url FROM produk WHERE toko_id = ${auth.tokoId} AND foto_url IS NOT NULL AND foto_url <> '' ORDER BY id LIMIT ${max}`

  const idSet = new Set<number>(rows.map(r => r.id))
  // Konkurensi terbatas: proses dalam batch CONCURRENCY.
  let diproses = 0
  let pasanganBaru = 0
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async r => {
      const pas = await cariPasanganDuplikat(r.id, r.foto_url, auth.tokoId, idSet)
      for (const p of pas) {
        try {
          await sql`
            INSERT INTO produk_duplikat (toko_id, produk_id_a, produk_id_b, skor)
            VALUES (${auth.tokoId}, ${p.a}, ${p.b}, ${p.skor})
            ON CONFLICT (toko_id, produk_id_a, produk_id_b) DO NOTHING
          `
          pasanganBaru++
        } catch { /* baris mungkin konflik/hapus di tengah — abai */ }
      }
      diproses++
    }))
  }

  return NextResponse.json({ ok: true, diproses, pasanganBaru, totalProdukBerFoto: rows.length })
}
