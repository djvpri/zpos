import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  const sevenDays = new Date(today)
  sevenDays.setDate(sevenDays.getDate() + 7)

  // Stok menipis
  const stokMenipis = await sql`
    SELECT id, nama, stok, stok_minimum, foto_url
    FROM produk
    WHERE toko_id = ${toko.tokoId}
      AND aktif = true
      AND stok <= stok_minimum
      AND stok > 0
    ORDER BY stok ASC
  `

  // Stok habis
  const stokHabis = await sql`
    SELECT id, nama, stok, foto_url
    FROM produk
    WHERE toko_id = ${toko.tokoId}
      AND aktif = true
      AND stok = 0
    ORDER BY nama
  `

  // Kadaluarsa dalam 7 hari
  const mauKadaluarsa = await sql`
    SELECT id, nama, expired_at, stok, foto_url,
           (expired_at - CURRENT_DATE) AS sisa_hari
    FROM produk
    WHERE toko_id = ${toko.tokoId}
      AND aktif = true
      AND expired_at IS NOT NULL
      AND expired_at <= ${sevenDays.toISOString().slice(0, 10)}
      AND expired_at >= CURRENT_DATE
    ORDER BY expired_at ASC
  `

  // Sudah kadaluarsa
  const sudahKadaluarsa = await sql`
    SELECT id, nama, expired_at, stok, foto_url
    FROM produk
    WHERE toko_id = ${toko.tokoId}
      AND aktif = true
      AND expired_at IS NOT NULL
      AND expired_at < CURRENT_DATE
    ORDER BY expired_at ASC
  `

  return NextResponse.json({
    stokMenipis,
    stokHabis,
    mauKadaluarsa,
    sudahKadaluarsa,
    total: stokMenipis.length + stokHabis.length + mauKadaluarsa.length + sudahKadaluarsa.length
  })
}
