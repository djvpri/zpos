import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'

// PATCH:
//  a) tandai bon selesai (dibayar). Body { selesai: bool }.
//  b) edit isi bon + sinkron stok hold (kasir: tarik→tambah item→simpan ulang).
//     Body { produk: Record<number,number> } = FULL daftar item final.
//     Web bandingkan dgn produk_json tersimpan → hold selisih POSITIF (item nambah),
//     pulihkan selisih NEGATIF (item dikurangi/dihapus). Idempoten & anti-double-hold.
//  c) opsional { total } utk perbarui nilai list penanda.
export const PATCH = apiHandler(async (req: Request, body: { selesai?: boolean; produk?: Record<string, number>; total?: number }, context) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number((await context.params).id)

  // --- (a) tandai selesai / aktifkan kembali ---
  if (typeof body.selesai === 'boolean') {
    const selesai = body.selesai
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
  }

  // --- (b) edit isi bon + sinkron stok hold (delta) ---
  if (body.produk !== undefined) {
    const entries = Object.entries(body.produk ?? {}).map(([idStr, qty]) => [Number(idStr), Number(qty)] as const)
      .filter(([pid, qty]) => Number.isInteger(pid) && pid > 0 && Number.isInteger(qty) && qty > 0)
    const finalObj: Record<string, number> = {}
    for (const [pid, qty] of entries) finalObj[String(pid)] = qty
    if (entries.length > 50) return NextResponse.json({ error: 'Terlalu banyak item (maks 50)' }, { status: 400 })

    const row = await sql.begin(async t => {
      const [cur] = await t`
        SELECT id, produk_json, total, selesai FROM bon
        WHERE id = ${id} AND toko_id = ${toko.tokoId}
        FOR UPDATE
      `
      if (!cur) return null
      if (cur.selesai) return { err: 'Bon sudah selesai — tak bisa diedit' } as const
      const old: Record<string, number> = (() => { try { return JSON.parse(cur.produk_json) } catch { return {} } })()
      // Semua id target harus milik toko (jaga integritas).
      const owned = await t`SELECT id FROM produk WHERE toko_id = ${toko.tokoId} AND id = ANY(${Object.keys(finalObj).map(Number)})`
      const ownedSet = new Set(owned.map(o => Number(o.id)))
      const delta: Record<string, number> = {}
      let okOwned = true
      for (const [pidStr, qty] of Object.entries(finalObj)) {
        const pid = Number(pidStr)
        if (!ownedSet.has(pid)) { okOwned = false; break }
        const before = old[pidStr] || 0
        delta[pidStr] = qty - before
      }
      if (!okOwned) return { err: 'Terdapat produk tak valid' } as const
      // Terapkan hold delta: +kurangi stok (nambah item), -naikkan stok (kurangi item).
      for (const [pidStr, diff] of Object.entries(delta)) {
        const d = Number(diff)
        if (d > 0) await t`UPDATE produk SET stok = GREATEST(0, stok - ${d}), updated_at = now() WHERE id = ${Number(pidStr)} AND toko_id = ${toko.tokoId}`
        else if (d < 0) await t`UPDATE produk SET stok = stok + ${-d}, updated_at = now() WHERE id = ${Number(pidStr)} AND toko_id = ${toko.tokoId}`
      }
      const newTotal = Math.round(body.total ?? cur.total)
      const [upd] = await t`
        UPDATE bon SET produk_json = ${JSON.stringify(finalObj)}, total = ${newTotal}
        WHERE id = ${id} AND toko_id = ${toko.tokoId}
        RETURNING id, nama, produk_json, total, selesai, created_at
      `
      return upd
    })
    if (!row) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })
    if ('err' in row) return NextResponse.json({ error: row.err }, { status: 400 })
    void catatAktivitas(toko, 'bon_edit', `Bon #${row.id} diubah isinya`)
    return NextResponse.json({ ...row, produk: JSON.parse(row.produk_json) })
  }

  return NextResponse.json({ error: 'Body tidak dikenal' }, { status: 400 })
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
