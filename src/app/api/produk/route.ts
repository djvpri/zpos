import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { embedProduk } from '@/lib/zface-visual'
import { produkSchema } from '@/lib/validation'
import { generateProductBarcode } from '@/lib/barcode-code39'
import { apiHandler } from '@/lib/api-handler'
import type { Produk } from '@/types'

const LIMIT_PRODUK_TRIAL = 100

export async function GET(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT p.*, json_build_object('nama', k.nama) AS kategori
    FROM produk p
    LEFT JOIN kategori k ON k.id = p.kategori_id
    WHERE p.aktif = true AND p.toko_id = ${toko.tokoId}
    ORDER BY p.nama
  `
  return NextResponse.json(rows)
}

export const POST = apiHandler(async (req: Request, body: any) => {
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
      VALUES (${body.nama}, ${body.harga}, ${body.stok}, ${body.emoji}, ${body.deskripsi || null}, ${body.foto_url || null}, ${body.barcode || null}, ${body.kategori_id}, ${toko.tokoId}, ${body.expired_at || null}, ${body.stok_minimum ?? 5}, ${body.client_ref || null}, ${body.harga_grosir ?? null}, ${body.min_qty_grosir ?? null})
      RETURNING *
    `

    // Produk tanpa barcode (baru, buatan lokal): auto-generate barcode internal
    // unik (2 + id 11 digit + Luhn → 13 digit) supaya tetap bisa discan &
    // dipakai label harga/barcode. Hanya sekali, id tak berubah lagi.
    if (!row.barcode) {
      await sql`UPDATE produk SET barcode = ${generateProductBarcode(row.id)} WHERE id = ${row.id}`
      ;[row] = await sql`SELECT * FROM produk WHERE id = ${row.id}`
    }
  } catch (e: any) {
    if (body.client_ref && e.code === '23505') {
      const [existing] = await sql`SELECT * FROM produk WHERE client_ref = ${body.client_ref} AND toko_id = ${toko.tokoId}`
      if (existing) return NextResponse.json(existing, { status: 409 })
    }
    // Unique barcode (produk_toko_barcode_unik): barcode sudah dipakai produk
    // lain dalam toko ini. Beri pesan informatif, bukan internal error 500.
    if (body.barcode && e.code === '23505') {
      return NextResponse.json({ error: `Barcode ${body.barcode} sudah dipakai produk lain di toko ini.` }, { status: 409 })
    }
    throw e
  }

  if (row.foto_url) {
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
}, { schema: produkSchema })
