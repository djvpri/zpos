import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'
import { resolveSesi, appendSesi, normalSesi, normalVmap, type BonSesi } from '@/lib/bon-sesi'

// PATCH:
//  a) tandai bon selesai (dibayar). Body { selesai: bool }.
//  b) edit isi bon + sinkron stok hold (kasir: tarik→tambah item→simpan ulang).
//     Body { produk: Record<number,number> } = FULL daftar item final.
//     Web bandingkan dgn produk_json tersimpan → hold selisih POSITIF (item nambah),
//     pulihkan selisih NEGATIF (item dikurangi/dihapus). Idempoten & anti-double-hold.
//  c) opsional { total } utk perbarui nilai list penanda.
export const PATCH = apiHandler(async (req: Request, body: { selesai?: boolean; produk?: Record<string, number>; harga?: Record<string, number> | null; sesi?: unknown; vmap?: Record<string, { nama?: string; harga?: number }> | null; total?: number }, context) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number((await context.params).id)

  // Auto-migrate kolom harga terkunci (idempotent) — PATCH bisa jalan sebelum GET.
  await sql.unsafe('ALTER TABLE bon ADD COLUMN IF NOT EXISTS harga_json text')
  // vmap_json = nama/harga item virtual (id negatif) — lihat POST /api/bon.
  await sql.unsafe('ALTER TABLE bon ADD COLUMN IF NOT EXISTS vmap_json text')

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
      `Bon Gantung #${row.id} ${selesai ? 'dibayar/selesai' : 'diaktifkan kembali'}`)
    return NextResponse.json(row)
  }

  // --- (b) edit isi bon + sinkron stok hold (delta) ---
  if (body.produk !== undefined) {
    // Item virtual (id < 0) ikut diedit; validasinya lewat `vmap` (bukan tabel produk).
    const vmap = normalVmap(body.vmap)
    const entries = Object.entries(body.produk ?? {}).map(([idStr, qty]) => [Number(idStr), Number(qty)] as const)
      .filter(([pid, qty]) => Number.isInteger(pid) && pid !== 0 && Number.isInteger(qty) && qty > 0)
    const finalObj: Record<string, number> = {}
    for (const [pid, qty] of entries) finalObj[String(pid)] = qty
    if (entries.length > 50) return NextResponse.json({ error: 'Terlalu banyak item (maks 50)' }, { status: 400 })

    let nextSesi: BonSesi[] = []
    const row = await sql.begin(async t => {
      const [cur] = await t`
        SELECT id, produk_json, sesi_json, harga_json, vmap_json, total, selesai, created_at FROM bon
        WHERE id = ${id} AND toko_id = ${toko.tokoId}
        FOR UPDATE
      `
      if (!cur) return null
      if (cur.selesai) return { err: 'Bon sudah selesai — tak bisa diedit' } as const
      const old: Record<string, number> = (() => { try { return JSON.parse(cur.produk_json) } catch { return {} } })()
      const oldVmap: Record<string, { nama: string; harga: number }> = (() => { try { return cur.vmap_json ? JSON.parse(cur.vmap_json) : {} } catch { return {} } })()
      // Semua id ASLI (positif) harus milik toko; item virtual (negatif) cukup
      // ada di vmap lama ATAU vmap kiriman (biar item lama tetap bisa diedit
      // walau klien tak mengirim ulang seluruh vmap-nya).
      const idsAsli = Object.keys(finalObj).map(Number).filter(n => n > 0)
      const owned = idsAsli.length
        ? await t`SELECT id FROM produk WHERE toko_id = ${toko.tokoId} AND id = ANY(${idsAsli})`
        : []
      const ownedSet = new Set(owned.map(o => Number(o.id)))
      const delta: Record<string, number> = {}
      let okOwned = true
      for (const [pidStr, qty] of Object.entries(finalObj)) {
        const pid = Number(pidStr)
        if (pid < 0) {
          if (!vmap[pidStr] && !oldVmap[pidStr]) { okOwned = false; break }
        } else if (!ownedSet.has(pid)) { okOwned = false; break }
        const before = old[pidStr] || 0
        delta[pidStr] = qty - before
      }
      if (!okOwned) return { err: 'Terdapat produk tak valid' } as const
      // Terapkan hold delta: +kurangi stok (nambah item), -naikkan stok (kurangi item).
      // Item virtual dilewati (tak ada row produk).
      for (const [pidStr, diff] of Object.entries(delta)) {
        if (Number(pidStr) < 0) continue
        const d = Number(diff)
        if (d > 0) await t`UPDATE produk SET stok = GREATEST(0, stok - ${d}), updated_at = now() WHERE id = ${Number(pidStr)} AND toko_id = ${toko.tokoId}`
        else if (d < 0) await t`UPDATE produk SET stok = stok + ${-d}, updated_at = now() WHERE id = ${Number(pidStr)} AND toko_id = ${toko.tokoId}`
      }
      const newTotal = Math.round(body.total ?? cur.total)
      // Simpan sesi (snapshot penuh) bila isi berubah — jaga jejak jam utk nota grup.
      const before = resolveSesi(cur.sesi_json, cur.produk_json, cur.created_at)
      const last = before.length ? before[before.length - 1] : null
      const berubah = !last || JSON.stringify(last.p) !== JSON.stringify(finalObj)
      // Klien (kasir) kirim snapshot sesi PENUH ber-harga → pakai apa adanya (grup
      // lama simpan harga saat grup dibuat, grup baru harga katalog saat itu).
      // Klien lama (web/tanpa sesi) → append sesi baru tanpa harga (fallback).
      const sesiIn = normalSesi(body.sesi)
      nextSesi = sesiIn.length
        ? sesiIn
        : (berubah ? appendSesi(before, new Date().toISOString(), finalObj) : before)
      // Harga terkunci (Opsi A): utamakan harga dari klien (kasir/web saat edit),
      // tapi selalu pertahankan harga lama utk item yg tak dikirim harga barunya.
      // Produk yg dihapus dari bon → harga-nya dibuang (ikut finalObj).
      let newHargaJson: string | null = cur.harga_json ?? null
      const oldHarga: Record<string, number> = (() => { try { return cur.harga_json ? JSON.parse(cur.harga_json) : {} } catch { return {} } })()
      const merged: Record<string, number> = {}
      for (const pidStr of Object.keys(finalObj)) {
        const hb = body.harga ? Number(body.harga[pidStr]) : NaN
        const h = Number.isFinite(hb) && hb >= 0 ? Math.round(hb) : (oldHarga[pidStr] ?? NaN)
        if (Number.isFinite(h) && h >= 0) merged[pidStr] = h
      }
      if (Object.keys(merged).length) newHargaJson = JSON.stringify(merged)
      // vmap: gabung vmap lama + kiriman klien, buang yg item virtualnya tak ada lagi.
      const mergedVmap: Record<string, { nama: string; harga: number }> = {}
      for (const pidStr of Object.keys(finalObj)) {
        if (Number(pidStr) >= 0) continue
        const v = vmap[pidStr] ?? oldVmap[pidStr]
        if (v) mergedVmap[pidStr] = { nama: v.nama, harga: Number(v.harga) || 0 }
      }
      const newVmapJson = Object.keys(mergedVmap).length ? JSON.stringify(mergedVmap) : null
      const [upd] = await t`
        UPDATE bon
        SET produk_json = ${JSON.stringify(finalObj)},
            sesi_json = ${(sesiIn.length || berubah) ? JSON.stringify(nextSesi) : cur.sesi_json},
            harga_json = ${newHargaJson},
            vmap_json = ${newVmapJson},
            total = ${newTotal}
        WHERE id = ${id} AND toko_id = ${toko.tokoId}
        RETURNING id, nama, produk_json, sesi_json, harga_json, vmap_json, total, selesai, created_at
      `
      return upd
    })
    if (!row) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })
    if ('err' in row) return NextResponse.json({ error: row.err }, { status: 400 })
    void catatAktivitas(toko, 'bon_edit', `Bon Gantung #${row.id} diubah isinya`)
    return NextResponse.json({ ...row, produk: JSON.parse(row.produk_json), sesi: nextSesi ?? [] })
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
        if (Number(idStr) < 0) continue // item virtual: tak ada stok utk dipulihkan
        await t`
          UPDATE produk SET stok = stok + ${Number(qty)}, updated_at = now()
          WHERE id = ${Number(idStr)} AND toko_id = ${toko.tokoId}
        `
      }
    }
    return r
  })
  if (!row) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  void catatAktivitas(toko, 'bon_hapus', `Bon Gantung #${id} dihapus permanen`)
  return NextResponse.json({ ok: true })
}
