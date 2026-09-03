import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// Owner atur margin SENGKAL per SKU Digiflazz → berlaku utk SEMUA row produk
// digital dgn buyer_sku_code tsb di semua toko sekaligus (ganti mekanisme lama
// yg set per-row-produk per-toko satu per satu di tab "Kelola Pulsa").
export async function PATCH(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { buyer_sku_code, margin_type, margin_persen, margin_nominal } = await req.json() as {
    buyer_sku_code?: unknown; margin_type?: unknown; margin_persen?: unknown; margin_nominal?: unknown
  }
  const sku = (typeof buyer_sku_code === 'string' ? buyer_sku_code.trim() : '')
  if (!sku) return NextResponse.json({ error: 'buyer_sku_code wajib diisi' }, { status: 400 })

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

  // Set margin utk SEMUA baris produk digital dgn SKU ini (di semua toko).
  const [{ count }] = await sql`
    UPDATE produk
    SET margin_type = ${mtype}, margin_persen = ${persen}, margin_nominal = ${nominal},
        updated_at = now()
    WHERE jenis = 'digital' AND buyer_sku_code = ${sku}
    RETURNING count(*)::int AS count
  `
  return NextResponse.json({ ok: true, buyer_sku_code: sku, margin_type: mtype, margin_persen: persen, margin_nominal: nominal, count })
}
