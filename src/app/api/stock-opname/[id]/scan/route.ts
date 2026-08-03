import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { stockOpnameScanSchema } from '@/lib/validation'
import { ambilSesi } from '@/lib/stock-opname'

// POST /api/stock-opname/[id]/scan — catat satu barcode produk (stok_fisik += qty).
// Online-only. Hanya utk sesi berstatus 'proses'.
//
// Barcode yang TIDAK dikenal (produk nya toko ini, barcode tak cocok):
//   → TIDAK dicatat sebagai baris (tak ada produk yg di-update). Kembalikan
//     flag 'tak_dikenal' + pesan; UI tampil peringatan & kasir cek manual.
//   Alasan: schema detail PK (so_id, produk_id) tak bisa menampung barcode
//   phantom (produk_id tak valid). Lebih aman tolak & kasir cek manual.
export const POST = apiHandler(
  async (req, body: { barcode: string; qty: number }, context: { params: Promise<Record<string, string | string[]>> }) => {
    const toko = await getTokoFromRequest(req)
    if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const idNum = Number(Array.isArray(id) ? id[0] : id)
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const sesi = await ambilSesi(toko.tokoId, idNum)
    if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    if (sesi.status !== 'proses') {
      return NextResponse.json({ error: 'Sesi sudah ' + sesi.status }, { status: 409 })
    }

    const bc = body.barcode.trim()
    const qty = body.qty

    const [produk] = await sql`
      SELECT id, nama, stok, kategori_id
      FROM produk
      WHERE toko_id = ${toko.tokoId} AND barcode = ${bc} AND aktif = true
    `

    if (!produk) {
      return NextResponse.json(
        { ok: false, flag: 'tak_dikenal', pesan: `Barcode ${bc} tidak dikenal di toko ini` },
        { status: 200 },
      )
    }

    // Upsert detail: stok_fisik naik qty, stok_sistem di-snapshot.
    await sql`
      INSERT INTO stock_opname_detail (so_id, produk_id, nama, barcode, kategori_id, stok_sistem, stok_fisik)
      VALUES (${idNum}, ${produk.id}, ${produk.nama}, ${bc}, ${produk.kategori_id}, ${produk.stok}, ${qty})
      ON CONFLICT (so_id, produk_id) DO UPDATE SET
        stok_fisik = stock_opname_detail.stok_fisik + EXCLUDED.stok_fisik,
        dicatat_ts = now()
    `

    const [baris] = await sql`
      SELECT d.produk_id, d.nama, d.barcode, d.stok_sistem, d.stok_fisik,
             (d.stok_fisik - d.stok_sistem)::int AS selisih
      FROM stock_opname_detail d WHERE d.so_id = ${idNum} AND d.produk_id = ${produk.id}
    `

    return NextResponse.json({ ok: true, flag: 'ok', baris })
  },
  { schema: stockOpnameScanSchema },
)
