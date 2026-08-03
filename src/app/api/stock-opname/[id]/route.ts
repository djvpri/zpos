import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// GET /api/stock-opname/[id] — detail satu sesi SO: header + daftar baris hasil
// scan/selisih, diurutkan selisih terkecil (minus paling besar) di atas biar
// item yang hilang paling mencolok.
export async function GET(
  req: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const idNum = Number(Array.isArray(id) ? id[0] : id)
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  }

  const [sesi] = await sql`
    SELECT id, nomor_so, nama, scope, status, jumlah_baris, dibuat_oleh, dibuat_at, selesai_at, disetujui_at
    FROM stock_opname WHERE id = ${idNum} AND toko_id = ${toko.tokoId}
  `
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

  const baris = await sql`
    SELECT d.produk_id, COALESCE(d.nama, p.nama) AS nama, d.barcode,
           d.stok_sistem, d.stok_fisik, d.selisih, d.dicatat_ts, k.nama AS kategori
    FROM stock_opname_detail d
    LEFT JOIN produk p ON p.id = d.produk_id
    LEFT JOIN kategori k ON k.id = d.kategori_id
    WHERE d.so_id = ${idNum}
    ORDER BY d.selisih ASC, COALESCE(d.nama, p.nama) ASC
  `
  return NextResponse.json({ sesi, baris })
}
