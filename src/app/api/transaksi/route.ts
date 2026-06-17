import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import type { Transaksi, DetailTransaksi } from '@/types'

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { trx, items }: { trx: Transaksi; items: DetailTransaksi[] } = await req.json()

  const [saved] = await sql`
    INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id)
    VALUES (${trx.no_transaksi}, ${trx.subtotal}, ${trx.diskon}, ${trx.pajak}, ${trx.total},
            ${trx.bayar}, ${trx.kembali}, ${trx.metode_bayar}, ${toko.userName}, ${toko.tokoId})
    RETURNING *
  `

  if (items.length > 0) {
    const rows = items.map(i => ({
      transaksi_id: saved.id as number,
      produk_id: i.produk_id,
      nama_produk: i.nama_produk,
      harga: i.harga,
      qty: i.qty,
      subtotal: i.subtotal,
      toko_id: toko.tokoId,
    }))
    await sql`INSERT INTO detail_transaksi ${sql(rows)}`
  }

  return NextResponse.json(saved)
}

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 20)
  const rows = await sql`
    SELECT * FROM transaksi WHERE toko_id = ${toko.tokoId} ORDER BY created_at DESC LIMIT ${limit}
  `
  return NextResponse.json(rows)
}
