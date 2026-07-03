import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { embedProduk } from '@/lib/zface-visual'
import type { Produk } from '@/types'

const LIMIT_PRODUK_TRIAL = 100

export async function GET(req: Request) {
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

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

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
      INSERT INTO produk (nama, harga, stok, emoji, deskripsi, foto_url, barcode, kategori_id, toko_id, expired_at, stok_minimum, client_ref)
      VALUES (${body.nama}, ${body.harga}, ${body.stok}, ${body.emoji}, ${body.deskripsi || null}, ${body.foto_url || null}, ${body.barcode || null}, ${body.kategori_id}, ${toko.tokoId}, ${body.expired_at || null}, ${body.stok_minimum ?? 5}, ${body.client_ref || null})
      RETURNING *
    `
  } catch (e: any) {
    // Race sempit: dua flush dari client_ref sama persis nyaris bersamaan
    // (mis. dua tab), keduanya lolos cek "belum ada" sebelum salah satu
    // insert duluan. Constraint UNIQUE di DB tetap menahan yang kedua —
    // di sini cukup kembalikan baris yang sudah ada, bukan error 500.
    if (body.client_ref && e.code === '23505') {
      const [existing] = await sql`SELECT * FROM produk WHERE client_ref = ${body.client_ref} AND toko_id = ${toko.tokoId}`
      if (existing) return NextResponse.json(existing, { status: 409 })
    }
    throw e
  }

  // Embed foto ke ZFace (server-side) kalau ada foto. tokoId dari sesi
  // terverifikasi (toko.tokoId), BUKAN dari body request — sebelumnya ini
  // dipanggil langsung dari browser dengan tokoId dari client, memungkinkan
  // client yang dimodifikasi mengirim tokoId sembarang.
  if (row.foto_url) {
    embedProduk({
      produkId: row.id,
      nama: row.nama,
      harga: row.harga,
      fotoBase64: row.foto_url,
      tokoId: toko.tokoId,
      fotoUrl: row.foto_url,
    }).catch(() => {}) // silent fail — jangan gagalkan simpan produk kalau ZFace down
  }

  return NextResponse.json(row)
}
