import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { priceList } from '@/lib/digiflazz'

export const runtime = 'nodejs'

// Admin z1pos: daftar produk Digiflazz (harga list utk jual pulsa).
// Baca-only tampilkan price-list → admin/informasi sebelum set produk digital.
// Sudah-produk: tandai buyer_sku_code mana yang sudah jadi produk digital (jenis=digital)
// supaya admin tahu yang mana sudah dijual. Tidak melarang duplikat (upsert di alur lain).
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const { prepaid, pasca } = await priceList(refresh)

  // kode yg sudah dijadikan produk digital (ada di DB, jenis digital)
  const kodeSdh = refresh
    ? []
    : (await sql`SELECT DISTINCT buyer_sku_code FROM produk WHERE jenis = 'digital' AND buyer_sku_code IS NOT NULL`).map((r) => r.buyer_sku_code)
  const ada = new Set<string>(kodeSdh)

  const tandai = (list: typeof prepaid) =>
    list.map((p) => ({ ...p, sudah_produk: ada.has(p.buyer_sku_code) }))

  return NextResponse.json({ prepaid: tandai(prepaid), pasca: tandai(pasca), total: prepaid.length + pasca.length })
}
