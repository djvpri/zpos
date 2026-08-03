import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { ambilSesi, hitungSelisih } from '@/lib/stock-opname'
import { catatAktivitas } from '@/lib/aktivitas'
import { stockOpnameSelesaiSchema } from '@/lib/validation'

// POST /api/stock-opname/[id]/selesai — hentikan scan, hitung selisih utk SEMUA
// produk dalam cakupan (yang tak discan dianggap stok_fisik 0), status -> 'selesai'.
// TIDAK mengubah produk.stok di sini — itu hanya terjadi di approve.
export const POST = apiHandler(
  async (_req, _body, context: { params: Promise<Record<string, string | string[]>> }) => {
    const toko = await getTokoFromRequest(_req)
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

    const baris = await hitungSelisih(idNum, toko.tokoId, sesi.scope)

    const totalSelisih = baris.reduce((a, r) => a + Number(r.selisih ?? 0), 0)
    const adaSelisih = baris.filter((r) => Number(r.selisih) !== 0).length
    const jumlahBaris = baris.length

    await sql`
      UPDATE stock_opname
      SET status = 'selesai', selesai_at = now(), jumlah_baris = ${jumlahBaris}
      WHERE id = ${idNum}
    `

    catatAktivitas(
      toko,
      'so_selesai',
      `Sesuai ${sesi.nomor_so}: ${jumlahBaris} item, ${adaSelisih} selisih, total ${totalSelisih}`,
    )

    return NextResponse.json({
      ok: true,
      nomor_so: sesi.nomor_so,
      jumlah_baris: jumlahBaris,
      ada_selisih: adaSelisih,
      total_selisih: totalSelisih,
    })
  },
  { schema: stockOpnameSelesaiSchema },
)
