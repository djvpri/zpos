import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Ambil detail nota bon utk dicetak: resolve produk_json (id→qty) ke
// daftar item {nama, harga, qty, subtotal}. Harga diambil dari tabel produk
// terkini (konsisten dgn logika tebus bon yg menghitung ulang harga).
// Admin / kasir toko tsb.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID bon tidak valid' }, { status: 400 })

  const [bon] = await sql`
    SELECT id, nama, produk_json, total, selesai, created_at, dibayar_at
    FROM bon
    WHERE id = ${id} AND toko_id = ${toko.tokoId}`

  if (!bon) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  const produk: Record<number, number> = JSON.parse(bon.produk_json)
  const ids = Object.keys(produk).map(Number)

  // Detail produk milik toko ini utk nama & harga nota.
  let produkInfo: { id: number; nama: string; harga: number }[] = []
  if (ids.length) {
    produkInfo = await sql`
      SELECT id, nama, harga
      FROM produk
      WHERE id = ANY(${ids}) AND toko_id = ${toko.tokoId}`
  }
  const info = new Map(produkInfo.map(p => [Number(p.id), p]))

  const items = ids.map(id => {
    const p = info.get(id)
    const qty = produk[id]
    const harga = p?.harga ?? 0
    return { produk_id: id, nama: p?.nama ?? `Produk #${id}`, harga, qty, subtotal: Math.round(harga * qty) }
  })

  return NextResponse.json({
    id: bon.id,
    nama: bon.nama,
    total: bon.total,
    selesai: bon.selesai,
    created_at: bon.created_at,
    dibayar_at: bon.dibayar_at,
    items,
  })
}
