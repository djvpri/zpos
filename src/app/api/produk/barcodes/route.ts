import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// GET: seluruh barcode produk di toko ini (ringan, cuma string[]).
// Dipakai Scan Barcode Massal utk melewati produk yang SUDAH ADA di toko
// (jangan timpa harga/stok). Dibedakan dari mode paged `/api/produk` yang
// hanya berisi barcode halaman aktif — daftar SET harus lengkap biar valid.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT barcode FROM produk
    WHERE toko_id = ${toko.tokoId} AND barcode IS NOT NULL AND barcode <> ''
  `
  const barcodes = rows.map((r) => r.barcode) as string[]
  return NextResponse.json({ barcodes })
}
