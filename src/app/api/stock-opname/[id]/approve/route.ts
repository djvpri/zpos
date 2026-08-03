import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { ambilSesi } from '@/lib/stock-opname'
import { catatAktivitas } from '@/lib/aktivitas'
import { stockOpnameSelesaiSchema } from '@/lib/validation'

// POST /api/stock-opname/[id]/approve — ADMIN mengesahkan hasil SO: tulis
// produk.stok = stok_fisik utk seluruh baris detail (kuantitas fisik hasil hitung).
// Hanya utk sesi 'selesai' (sudah hitung selisih, belum disetujui). Idempotent
// terhadap status 'disetujui': panggil ulang ditolak 409.
export const POST = apiHandler(
  async (_req, _body, context: { params: Promise<Record<string, string | string[]>> }) => {
    const toko = await getTokoFromRequest(_req)
    if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (toko.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — hanya admin yang approve ' }, { status: 403 })
    }
    const { id } = await context.params
    const idNum = Number(Array.isArray(id) ? id[0] : id)
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const sesi = await ambilSesi(toko.tokoId, idNum)
    if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    if (sesi.status !== 'selesai') {
      return NextResponse.json({ error: 'Sesi harus berstatus selesai dulu' }, { status: 409 })
    }

    // Terapkan stok fisik ke produk, dalam satu transaksi.
    const tx = await sql.begin(async (db) => {
      const baris = await db`
        SELECT produk_id, stok_fisik FROM stock_opname_detail WHERE so_id = ${idNum} AND produk_id <> 0
      `
      let terapkan = 0
      for (const r of baris) {
        await db`UPDATE produk SET stok = ${r.stok_fisik} WHERE id = ${r.produk_id}`
        terapkan++
      }
      await db`
        UPDATE stock_opname SET status = 'disetujui', disetujui_at = now() WHERE id = ${idNum}
      `
      return { terapkan }
    })

    catatAktivitas(toko, 'so_approve', `Approve ${sesi.nomor_so}: ${tx.terapkan} produk disesuaikan`)
    return NextResponse.json({ ok: true, terapkan: tx.terapkan, nomor_so: sesi.nomor_so })
  },
  { schema: stockOpnameSelesaiSchema },
)
