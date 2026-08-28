import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { inquiryPasca, type DigiflazzRow } from '@/lib/digiflazz'

export const runtime = 'nodejs'

// Inquiry tagihan pascabayar (PLN/PDAM/dst) — step 1 dari 2.
// Kasir memasukkan customer_no item pasca di keranjang, lalu menekan
// "Cek Tagihan" → server tanya Digiflazz → tampilkan nama + daftar tagihan.
// Step 2 (pembayaran) dilakukan di /api/transaksi biasa (brand='pasca').
//
// Body: { buyer_sku_code: string, customer_no: string }
// Return: data[0] Digiflazz (customer_name, status, price, desc.detail, ...)
export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { buyer_sku_code?: unknown; customer_no?: unknown }
  try { body = (await req.json()) as typeof body } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  const sku = String(body?.buyer_sku_code ?? '').trim()
  const customerNo = String(body?.customer_no ?? '').trim()
  if (!sku || !customerNo) {
    return NextResponse.json({ error: 'buyer_sku_code & customer_no wajib' }, { status: 400 })
  }

  const refId = `INQ${Date.now()}${Math.floor(Math.random() * 900 + 100)}`
  try {
    const r = await inquiryPasca(sku, customerNo, refId)
    const rd = (r?.data?.[0] ?? (r?.data as unknown) ?? {}) as DigiflazzRow
    const desc = (rd as Record<string, unknown>).desc
    const detail = desc && typeof desc === 'object' ? (desc as { detail?: unknown }).detail ?? null : null
    // rc != 00 → inquiry gagal (misal no tagihan salah), terjemahkan.
    const ok = String(rd.status ?? rd.rc ?? '').toLowerCase() !== 'gagal' && rd.rc !== '02'
    return NextResponse.json({
      ok,
      sku,
      customer_no: customerNo,
      status: rd.status ?? null,
      rc: rd.rc ?? null,
      customer_name: rd.customer_name ?? null,
      nama_produk: rd.buyer_product_name ?? rd.product_name ?? null,
      harga: rd.price ?? rd.selling_price ?? null,
      admin: rd.admin ?? null,
      message: rd.message ?? rd.desc ?? null,
      detail,
      raw: rd,
    })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'Gagal inquiry Digiflazz' }, { status: 502 })
  }
}
