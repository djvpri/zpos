import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { setMarginSku } from '@/lib/sync-digital'

// Owner atur margin GLOBAL per SKU Digiflazz → disimpan di master digital_sku
// (authoritative) lalu disebar ke SEMUA row produk digital SKU tsb di semua
// toko sekaligus (ganti mekanisme lama per-row-produk per-toko satu per satu
// di tab "Kelola Pulsa").
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

  // Set margin global utk SKU ini: master authoritative + sebar ke semua row
  // produk digital SKU tsb (semua toko yang sudah punya row).
  const { updated } = await setMarginSku(sku, mtype, persen, nominal)
  return NextResponse.json({ ok: true, buyer_sku_code: sku, margin_type: mtype, margin_persen: persen, margin_nominal: nominal, count: updated })
}
