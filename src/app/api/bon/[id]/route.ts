import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'

// PATCH tandai bon selesai (dibayar/selesai ditarik). Body { selesai: true }.
// Kalau false → aktifkan kembali (jarang, tapi ada utk undo).
export const PATCH = apiHandler(async (req: Request, body: { selesai: boolean }, context) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number((await context.params).id)
  const selesai = !!body.selesai
  // Kala set ke selesai, catat waktu dibayar. Set aktif (selesai=false) → kosongkan.
  const [row] = await sql`
    UPDATE bon
    SET selesai = ${selesai},
        dibayar_at = ${selesai ? sql`now()` : null}
    WHERE id = ${id} AND toko_id = ${toko.tokoId}
    RETURNING id, selesai, dibayar_at
  `
  if (!row) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  void catatAktivitas(toko, 'bon_bayar',
    `Bon #${row.id} ${selesai ? 'dibayar/selesai' : 'diaktifkan kembali'}`)
  return NextResponse.json(row)
})

// DELETE hapus bon (dibuang, bukan ditarik).
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number((await context.params).id)
  const [row] = await sql`DELETE FROM bon WHERE id = ${id} AND toko_id = ${toko.tokoId} RETURNING id`
  if (!row) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  void catatAktivitas(toko, 'data_hapus', `Bon #${id} dihapus permanen`)
  return NextResponse.json({ ok: true })
}
