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
  const row = await sql.begin(async t => {
    const [r] = await t`
      DELETE FROM bon WHERE id = ${id} AND toko_id = ${toko.tokoId}
      RETURNING id, selesai, produk_json
    `
    if (!r) return null
    // Batal = barang bon KEMBALI → pulihkan stok (opposite dari hold di POST).
    // Kompat: produk_json bisa string JSON (baru) atau belum → parse aman.
    // Bon yang sudah selesai tetap dihapus tapi stok tak dikembalikan (barang uda dibawa).
    if (!r.selesai) {
      const produk: Record<string, number> = (() => {
        try { return JSON.parse(r.produk_json) } catch { return {} }
      })()
      for (const [idStr, qty] of Object.entries(produk)) {
        await t`
          UPDATE produk SET stok = stok + ${Number(qty)}, updated_at = now()
          WHERE id = ${Number(idStr)} AND toko_id = ${toko.tokoId}
        `
      }
    }
    return r
  })
  if (!row) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  void catatAktivitas(toko, 'bon_hapus', `Bon #${id} dihapus permanen`)
  return NextResponse.json({ ok: true })
}
