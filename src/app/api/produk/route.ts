import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'

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

  const status = await statusToko(toko.tokoId)
  if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan. Hubungi admin.' }, { status: 403 })
  if (status.expired) return NextResponse.json({ error: 'Langganan sudah habis. Hubungi admin untuk memperpanjang.' }, { status: 403 })

  if (status.plan === 'trial') {
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM produk WHERE toko_id = ${toko.tokoId} AND aktif = true`
    if (count >= LIMIT_PRODUK_TRIAL) {
      return NextResponse.json({ error: `Paket Trial dibatasi ${LIMIT_PRODUK_TRIAL} produk. Upgrade ke Pro untuk produk tak terbatas.` }, { status: 403 })
    }
  }

  const body = await req.json()
  const [row] = await sql`
    INSERT INTO produk (nama, harga, stok, emoji, kategori_id, toko_id)
    VALUES (${body.nama}, ${body.harga}, ${body.stok}, ${body.emoji}, ${body.kategori_id}, ${toko.tokoId})
    RETURNING *
  `
  return NextResponse.json(row)
}
