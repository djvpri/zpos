import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// Owner set margin produk digital (jalan pulsa via Digiflazz).
// margin_type: 'persen' (%; tambahan thd modal) ATAU 'nominal' (Rp tetap).
// Hanya OWNER (superadmin env) yang boleh — tenant TIDAK bisa ubah margin
// (skema produkUpdate tenant tak punya kolom margin_*).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const produkId = parseInt(id)

  const [produk] = await sql`
    SELECT id, buyer_sku_code, modal, jenis FROM produk WHERE id = ${produkId} AND aktif = true
  `
  if (!produk) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
  if (produk.jenis !== 'digital') {
    return NextResponse.json({ error: 'Produk bukan item digital (pulsa/tagihan)' }, { status: 400 })
  }

  const { margin_type, margin_persen, margin_nominal } = await req.json()
  const mtype = margin_type === 'nominal' ? 'nominal' : 'persen'

  let persen: number | null = null
  let nominal: number | null = null
  if (mtype === 'nominal') {
    nominal = Math.round(Number(margin_nominal) || 0)
    if (nominal < 0) return NextResponse.json({ error: 'Margin nominal tak boleh negatif' }, { status: 400 })
  } else {
    persen = Math.round(Number(margin_persen) || 0)
    if (persen < 0) return NextResponse.json({ error: 'Margin persen tak boleh negatif' }, { status: 400 })
  }

  const [updated] = await sql`
    UPDATE produk SET margin_type = ${mtype}, margin_persen = ${persen}, margin_nominal = ${nominal}
    WHERE id = ${produkId}
    RETURNING id, buyer_sku_code, modal, jenis, margin_type, margin_persen, margin_nominal
  `
  return NextResponse.json(updated)
}
