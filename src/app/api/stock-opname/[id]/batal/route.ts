import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { ambilSesi } from '@/lib/stock-opname'
import { catatAktivitas } from '@/lib/aktivitas'
import { stockOpnameSelesaiSchema } from '@/lib/validation'

// POST /api/stock-opname/[id]/batal — batalkan sesi yang masih 'proses'/'selesai'.
// Tak mengubah produk.stok apa pun. Menjaga riwayat (status 'dibatalkan').
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
    if (sesi.status !== 'proses' && sesi.status !== 'selesai') {
      return NextResponse.json({ error: 'Sesi sudah ' + sesi.status }, { status: 409 })
    }

    await sql`UPDATE stock_opname SET status = 'dibatalkan' WHERE id = ${idNum}`
    catatAktivitas(toko, 'so_batal', `Batalkan ${sesi.nomor_so}`)
    return NextResponse.json({ ok: true })
  },
  { schema: stockOpnameSelesaiSchema },
)
