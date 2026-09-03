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
  // + margin yg berlaku (sekali di-set via margi global = sama semua row SKU;
  // ambil contoh row terbaru utk label/display UI Harga Pulsa).
  const mapa = new Map<string, { margin_type: string | null; margin_persen: number | null; margin_nominal: number | null }>()
  if (!refresh) {
    const rows = await sql`
      SELECT DISTINCT ON (buyer_sku_code)
             buyer_sku_code, margin_type, margin_persen, margin_nominal
      FROM produk WHERE jenis = 'digital' AND buyer_sku_code IS NOT NULL AND aktif = true
      ORDER BY buyer_sku_code, id DESC
    `
    for (const r of rows) mapa.set(r.buyer_sku_code, { margin_type: r.margin_type, margin_persen: r.margin_persen, margin_nominal: r.margin_nominal })
  }

  const tandai = (list: typeof prepaid) =>
    list.map((p) => {
      const m = mapa.get(p.buyer_sku_code) ?? null
      return { ...p, sudah_produk: mapa.has(p.buyer_sku_code), margin: m }
    })

  return NextResponse.json({ prepaid: tandai(prepaid), pasca: tandai(pasca), total: prepaid.length + pasca.length })
}
