import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { embedProduk, hapusEmbedding } from '@/lib/zface-visual'
import { produkUpdateSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'
import { z } from 'zod'
import type { Produk } from '@/types'

// GET satu produk LENGKAP (termasuk foto_url besar). Dipakai modal edit —
// list produk sengaja TIDAK mengirim foto_url (lihat GET /api/produk) supaya
// payload ringan; baru diambil di sini saat benar-benar perlu.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await sql`
    SELECT p.*, json_build_object('nama', k.nama) AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.id = ${Number(id)} AND p.toko_id = ${toko.tokoId} AND p.aktif = true
  `
  if (!row) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
  return NextResponse.json(row)
}

export const PUT = apiHandler(async (req: Request, body: z.infer<typeof produkUpdateSchema>, context) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const id = String(params.id)
  let row: Produk
  try {
    ;[row] = await sql`
      UPDATE produk
      SET nama = ${body.nama ?? null}, harga = ${body.harga ?? null}, stok = ${body.stok ?? null},
          emoji = ${body.emoji ?? null}, deskripsi = ${body.deskripsi || null}, foto_url = ${body.foto_url || null},
          barcode = ${body.barcode || null}, kategori_id = ${body.kategori_id ?? null},
          harga_grosir = ${body.harga_grosir ?? null}, min_qty_grosir = ${body.min_qty_grosir ?? null}
      WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}
      RETURNING *
    `
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `Nama "${body.nama}" sudah dipakai produk lain di toko ini.` }, { status: 409 })
    }
    throw e
  }

  if (row?.foto_url) {
    embedProduk({
      produkId: row.id,
      nama: row.nama,
      harga: row.harga,
      fotoBase64: row.foto_url,
      tokoId: toko.tokoId,
      fotoUrl: row.foto_url,
    }).catch(() => {})
  }

  return NextResponse.json(row)
}, { schema: produkUpdateSchema })

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await sql`UPDATE produk SET aktif = false WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}`
  hapusEmbedding({ produkId: Number(id), tokoId: toko.tokoId }).catch(() => {})
  return NextResponse.json({ ok: true })
}
