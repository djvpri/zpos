import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { embedProduk } from '@/lib/zface-visual'
import { buatThumbnail } from '@/lib/thumbnail'
import { catatBarcode } from '@/lib/barcode-katalog'
import { produkSchema } from '@/lib/validation'
import { generateProductBarcode } from '@/lib/barcode-code39'
import { apiHandler } from '@/lib/api-handler'
import { z } from 'zod'
import type { Produk } from '@/types'

const LIMIT_PRODUK_TRIAL = 100

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const semua = url.searchParams.get('semua') === '1'
  const q = (url.searchParams.get('q') ?? '').trim()
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 1) : null
  const sort = url.searchParams.get('sort') || 'nama'
  const orderBy = sort === 'terbaru' ? sql`ORDER BY p.created_at DESC` : sort === 'terlama' ? sql`ORDER BY p.created_at ASC` : sql`ORDER BY p.nama`

  const where = sql`p.aktif = true AND p.toko_id = ${toko.tokoId}`
  const qCond = q
    ? sql` AND (p.nama ILIKE ${'%' + q + '%'} OR p.barcode ILIKE ${'%' + q + '%'} OR k.nama ILIKE ${'%' + q + '%'})`
    : sql``

  // Mode paged (`?limit=...`): muat sebagian, dipakai halaman manajemen produk
  // (6000+ produk) supaya render instan & memory hemat. Mode full (tanpa limit,
  // utk sync app kasir + POS offline) tetap balikin semua buat kompatibilitas.
  if (limit) {
    const offset = (page - 1) * limit
    const [{ total }] = await sql`SELECT count(*)::int AS total FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id WHERE ${where} ${qCond}`
    const rows = await sql`
      SELECT p.*, json_build_object('nama', k.nama) AS kategori
      FROM produk p
      LEFT JOIN kategori k ON k.id = p.kategori_id
      WHERE ${where} ${qCond}
      ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `
    for (const r of rows) { r.foto_url = null; r.foto_thumb = null }
    return NextResponse.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) })
  }

  const rows = await sql`
    SELECT p.*, json_build_object('nama', k.nama) AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE ${where} ${qCond}
    ORDER BY p.nama
  `
  for (const r of rows) {
    r.foto_url = null
    // Mode ringan (`?semua=1`, dipakai sync app kasir Tauri): kirim TANPA
    // base64 thumbnail (~29MB utk 6000+ produk) supaya sinkron cepat & tak
    // bocor payload besar. Web (tanpa query) tetap sertakan foto_thumb preview.
    r.foto_thumb = semua ? null : (r.foto_thumb || null)
  }
  return NextResponse.json(rows)
}

export const POST = apiHandler(async (req: Request, body: z.infer<typeof produkSchema>) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Kalau ini retry dari antrian offline yang sempat sukses tapi
  // responsnya tidak sampai ke client (lihat lib/offline-produk-mutasi.ts),
  // kembalikan baris yang sudah ada — SEBELUM cek limit trial & embed foto,
  // supaya retry tidak salah kena limit / kirim ulang foto ke ZFace.
  if (body.client_ref) {
    const [existing] = await sql`SELECT * FROM produk WHERE client_ref = ${body.client_ref} AND toko_id = ${toko.tokoId}`
    if (existing) return NextResponse.json(existing, { status: 409 })
  }

  const status = await statusToko(toko.tokoId)
  if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan. Hubungi admin.' }, { status: 403 })
  if (status.expired) return NextResponse.json({ error: 'Langganan sudah habis. Hubungi admin untuk memperpanjang.' }, { status: 403 })

  if (status.plan === 'trial') {
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM produk WHERE toko_id = ${toko.tokoId} AND aktif = true`
    if (count >= LIMIT_PRODUK_TRIAL) {
      return NextResponse.json({ error: `Paket Trial dibatasi ${LIMIT_PRODUK_TRIAL} produk. Upgrade ke Pro untuk produk tak terbatas.` }, { status: 403 })
    }
  }

  let row: Produk
  try {
    ;[row] = await sql`
      INSERT INTO produk (nama, harga, stok, emoji, deskripsi, foto_url, barcode, kategori_id, toko_id, expired_at, stok_minimum, client_ref, harga_grosir, min_qty_grosir)
      VALUES (${body.nama}, ${body.harga}, ${body.stok}, ${body.emoji ?? null}, ${body.deskripsi || null}, ${body.foto_url || null}, ${body.barcode || null}, ${body.kategori_id}, ${toko.tokoId}, ${body.expired_at || null}, ${body.stok_minimum ?? 5}, ${body.client_ref || null}, ${body.harga_grosir ?? null}, ${body.min_qty_grosir ?? null})
      RETURNING *
    `

    // Produk tanpa barcode (baru, buatan lokal): auto-generate barcode internal
    // unik (2 + id 11 digit + Luhn → 13 digit) supaya tetap bisa discan &
    // dipakai label harga/barcode. Hanya sekali, id tak berubah lagi.
    if (!row.barcode) {
      await sql`UPDATE produk SET barcode = ${generateProductBarcode(row.id)} WHERE id = ${row.id}`
      ;[row] = await sql`SELECT * FROM produk WHERE id = ${row.id}`
    }
  } catch (e: unknown) {
    if (body.client_ref && (e as { code?: string })?.code === '23505') {
      const [existing] = await sql`SELECT * FROM produk WHERE client_ref = ${body.client_ref} AND toko_id = ${toko.tokoId}`
      if (existing) return NextResponse.json(existing, { status: 409 })
    }
    // Unique barcode (produk_toko_barcode_unik): barcode sudah dipakai produk
    // lain dalam toko ini. Beri pesan informatif, bukan internal error 500.
    if (body.barcode && (e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `Barcode ${body.barcode} sudah dipakai produk lain di toko ini.` }, { status: 409 })
    }
    // Unique nama (produk_toko_nama_unik): nama sudah dipakai produk mana pun
    // (aktif/nonaktif) dalam toko ini, case-insensitive. Tolak dgn pesan jelas.
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `Nama "${body.nama}" sudah dipakai produk lain di toko ini.` }, { status: 409 })
    }
    throw e
  }

  if (row.foto_url) {
    // Thumbnail kecil utk grid kasir (simpan ke foto_thumb), non-blocking —
    // kalau sharp gagal di sini kita tetap simpan produk & thumbnail di-update
    // nanti. foto_url besar TETAP disimpan utk detail/print.
    buatThumbnail(row.foto_url).then(thumb => {
      if (thumb) sql`UPDATE produk SET foto_thumb = ${thumb} WHERE id = ${row.id}`.catch(() => {})
    }).catch(() => {})

    embedProduk({
      produkId: row.id,
      nama: row.nama,
      harga: row.harga,
      fotoBase64: row.foto_url,
      tokoId: toko.tokoId,
      fotoUrl: row.foto_url,
    }).catch(() => {})
  }

  // Belajar otomatis: setiap produk baru yang ber-barcode memperkaya katalog
  // barcode pusat, supaya saran input makin lengkap sepanjang ZPos dipakai.
  if (row.barcode) {
    const [kat] = row.kategori_id
      ? await sql`SELECT nama FROM kategori WHERE id = ${row.kategori_id}`
      : [null]
    void catatBarcode({
      barcode: row.barcode,
      nama: row.nama,
      merek: null,
      kategori: kat?.nama || null,
    })
  }

  return NextResponse.json(row)
}, { schema: produkSchema })
