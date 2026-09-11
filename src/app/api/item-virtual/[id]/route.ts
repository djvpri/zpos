import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { validasiItemVirtual } from '@/lib/item-virtual'
import { pastikanTabel } from '../route'

// Edit & nonaktifkan item virtual katalog. Harga di bon LAMA tak terpengaruh:
// bon menyimpan nama+harga-nya sendiri di vmap/harga_json, jadi mengubah katalog
// hanya berlaku utk bon baru.

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await pastikanTabel()

  const { id } = await ctx.params
  const itemId = Number(id)
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON' }, { status: 400 })
  }

  const v = validasiItemVirtual(raw)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { nama, harga } = v.nilai

  try {
    // toko_id di WHERE = batas kepemilikan; item toko lain → 0 baris → 404.
    const [row] = await sql`
      UPDATE item_virtual
      SET nama = ${nama}, harga = ${harga}, updated_at = now()
      WHERE id = ${itemId} AND toko_id = ${toko.tokoId}
      RETURNING id, nama, harga
    `
    if (!row) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'Nama item sudah dipakai' }, { status: 400 })
    }
    console.error('item-virtual PATCH error', e)
    return NextResponse.json({ error: 'Gagal mengubah item' }, { status: 500 })
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await pastikanTabel()

  const { id } = await ctx.params
  const itemId = Number(id)
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  }

  // Nonaktifkan, JANGAN hapus baris: bon lama me-resolve nama item virtual lewat
  // nama+harga. Barisnya dibiarkan supaya riwayat tetap terbaca; index unik
  // (toko_id, lower(nama)) tetap menghalangi duplikat, dan POST akan
  // menghidupkannya lagi bila nama yang sama dibuat ulang.
  const [row] = await sql`
    UPDATE item_virtual SET aktif = false, updated_at = now()
    WHERE id = ${itemId} AND toko_id = ${toko.tokoId}
    RETURNING id
  `
  if (!row) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
