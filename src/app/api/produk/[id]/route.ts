import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { embedProduk, hapusEmbedding } from '@/lib/zface-visual'
import { produkUpdateSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'
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

  // ProdukUpdateSchema bersifat partial — client bisa kirim cuma {harga} (edit
  // cepat inline). JANGAN timpa field absen ke NULL (nama NOT NULL → crash).
  // Ambil row existing, gabung field dari body, lalu SET lengkap.
  const [existing] = await sql`SELECT * FROM produk WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}`
  if (!existing) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

  const merged = {
    ...existing,
    ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)),
  }

  let row: Produk
  try {
    ;[row] = await sql`
      UPDATE produk
      SET nama = ${merged.nama}, harga = ${merged.harga}, stok = ${merged.jenis === 'digital' ? 0 : merged.stok},
          emoji = ${merged.emoji ?? null}, deskripsi = ${merged.deskripsi || null}, foto_url = ${merged.foto_url || null},
          barcode = ${merged.barcode || null}, kategori_id = ${merged.kategori_id ?? null},
          harga_grosir = ${merged.harga_grosir ?? null}, min_qty_grosir = ${merged.min_qty_grosir ?? null},
          jenis = ${merged.jenis ?? 'fisik'}, buyer_sku_code = ${merged.buyer_sku_code || null},
          modal = ${merged.modal ?? null}, digital_brand = ${merged.digital_brand || null}
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

  // Audit: catat perubahan produk — sorot perubahan harga (kecurangan paling umum).
  const ubahHarga = () => {
    const lama = Number(existing.harga)
    const baru = Number(row.harga)
    const bagian = []
    if (lama !== baru) bagian.push(`harga Rp ${lama.toLocaleString('id-ID')} → Rp ${baru.toLocaleString('id-ID')}`)
    if (existing.nama !== row.nama) bagian.push(`nama "${existing.nama}" → "${row.nama}"`)
    if (Number(existing.stok) !== Number(row.stok)) bagian.push(`stok ${existing.stok} → ${row.stok}`)
    return bagian.length ? `#${row.id} ${[...bagian].join(' · ')}` : `#${row.id} update detail`
  }
  void catatAktivitas(toko, 'produk_ubah', ubahHarga())

  return NextResponse.json(row)
}, { schema: produkUpdateSchema })

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [existing] = await sql`SELECT nama, harga FROM produk WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}`
  if (existing) {
    void catatAktivitas(toko, 'produk_hapus',
      `"${existing.nama}" (harga Rp ${Number(existing.harga).toLocaleString('id-ID')}) dihapus/tak aktif`)
  }
  await sql`UPDATE produk SET aktif = false WHERE id = ${Number(id)} AND toko_id = ${toko.tokoId}`
  hapusEmbedding({ produkId: Number(id), tokoId: toko.tokoId }).catch(() => {})
  return NextResponse.json({ ok: true })
}
