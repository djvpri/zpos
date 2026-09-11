import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'
import { apiHandler } from '@/lib/api-handler'
import { resolveSesi, normalSesi, normalVmap } from '@/lib/bon-sesi'

// GET daftar bon. Default: yang masih aktif (selesai=false). ?semua=1 → termasuk dibayar.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Opsi A (harga terkunci): bon menyimpan harga satuan saat digantung, supaya
  // naik/turun harga katalog setelahnya TIDAK mengubah isi bon (bon = transaksi
  // terkunci, barang sudah diambil pembeli). Auto-migrate idempotent — sama pola
  // `member_nama` di /api/transaksi. Tanpa kolom ini, tarik bon jatuh ke harga
  // katalog terkini (perilaku lama) — jadi aman utk bon lama (harga_json null).
  await sql.unsafe('ALTER TABLE bon ADD COLUMN IF NOT EXISTS harga_json text')
  // vmap_json = {idVirtual: {nama,harga}} — nama baris item "Lainnya" di nota web.
  // Null utk bon lama (klien lama) → nota jatuh ke label "Produk #id" seperti dulu.
  await sql.unsafe('ALTER TABLE bon ADD COLUMN IF NOT EXISTS vmap_json text')

  const semua = new URL(req.url).searchParams.get('semua') === '1'
  const rows = await sql`
    SELECT id, nama, produk_json, sesi_json, harga_json, vmap_json, total, selesai, created_at, dibayar_at
    FROM bon
    WHERE toko_id = ${toko.tokoId} ${semua ? sql`` : sql`AND selesai = false`}
    ORDER BY selesai ASC, created_at DESC
  `
  // parse JSON di server → klien langsung pakai Record<number, number>
  const out = rows.map(r => ({
    id: r.id,
    nama: r.nama,
    produk: JSON.parse(r.produk_json),   // {produk_id: qty} final (kompat)
    sesi: resolveSesi(r.sesi_json, r.produk_json, r.created_at),  // grup tambahan utk nota
    harga: r.harga_json ? JSON.parse(r.harga_json) : null,  // {produk_id: harga} terkunci
    vmap: r.vmap_json ? JSON.parse(r.vmap_json) : null,     // {idVirtual: {nama,harga}}
    total: r.total,
    selesai: r.selesai,
    created_at: r.created_at,
    dibayar_at: r.dibayar_at,
  }))
  return NextResponse.json(out)
}

// POST simpan bon baru dari keranjang. Body { nama?, produk: Record<number,number>, total }.
// Validasi: produk harus bilangan id positif (id negatif = virtual → tak bisa digantung);
// qty > 0. Max item dibatasi biar payload wajar (50).
const KERANJANG_MAX = 50

export const POST = apiHandler(async (req: Request, body: { nama?: string | null; produk: Record<string, number>; harga?: Record<string, number> | null; sesi?: unknown; vmap?: Record<string, { nama?: string; harga?: number }> | null; total?: number }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Item virtual (id negatif, mis. "Lainnya" dari kasir) IKUT — idnya stabil
  // (hash nama+harga) & namanya dibawa `vmap`, jadi tak butuh ref produk.
  const vmap = normalVmap(body.vmap)
  const entries = Object.entries(body.produk ?? {}).map(([id, qty]) => [Number(id), Number(qty)] as const)
    .filter(([id, qty]) => Number.isInteger(id) && id !== 0 && Number.isInteger(qty) && qty > 0)

  if (entries.length === 0) return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
  if (entries.length > KERANJANG_MAX) return NextResponse.json({ error: 'Terlalu banyak item (maks 50)' }, { status: 400 })

  // Pastikan semua produk milik toko ini (jaga integritas cross-toko). Item
  // virtual (id < 0) tak punya row produk — valid selama ada di `vmap`.
  const ids = entries.map(([id]) => id).filter(id => id > 0)
  const owned = ids.length
    ? await sql`SELECT id FROM produk WHERE toko_id = ${toko.tokoId} AND id = ANY(${ids})`
    : []
  const ownedSet = new Set(owned.map(o => Number(o.id)))
  const valid = entries.filter(([id]) => id < 0 ? !!vmap[String(id)] : ownedSet.has(id))
  if (valid.length === 0) return NextResponse.json({ error: 'Tidak ada produk valid' }, { status: 400 })

  // total = penanda utk list; harga satuan terkunci disimpan terpisah di harga_json.
  const total = Math.round(body.total ?? 0)
  const produkObj: Record<string, number> = {}
  for (const [id, qty] of valid) produkObj[String(id)] = qty

  // Harga terkunci (Opsi A): simpan harga satuan saat digantung utk tiap item valid.
  // Kalau klien lama tak kirim → null (tarik jatuh ke harga katalog, perilaku lama).
  const hargaObj: Record<string, number> = {}
  if (body.harga) {
    for (const [id] of valid) {
      const h = Number(body.harga[String(id)])
      if (Number.isFinite(h) && h >= 0) hargaObj[String(id)] = Math.round(h)
    }
  }
  const hargaJson = Object.keys(hargaObj).length ? JSON.stringify(hargaObj) : null

  // vmap = {idVirtual: {nama, harga}} — sumber nama baris virtual di web (tanpa
  // vmap barisnya cuma tampil "Produk #-..."). Hanya id yg benar-benar dipakai.
  const vmapObj: Record<string, { nama: string; harga: number }> = {}
  for (const [id] of valid) {
    if (id < 0 && vmap[String(id)]) vmapObj[String(id)] = vmap[String(id)]
  }
  const vmapJson = Object.keys(vmapObj).length ? JSON.stringify(vmapObj) : null

  // Sesi ber-harga (per-kiriman) dari kasir: [{t, p:{id:qty}, h:{id:harga}}]. Kalau
  // klien lama tak kirim → 1 sesi sintesis dari created_at (resolveSesi bikin sendiri).
  const sesiIn = normalSesi(body.sesi)
  const sesiJson = sesiIn.length ? JSON.stringify(sesiIn) : null

  const row = await sql.begin(async t => {
    const [r] = await t`
      INSERT INTO bon (toko_id, nama, produk_json, sesi_json, harga_json, vmap_json, total)
      VALUES (${toko.tokoId}, ${body.nama?.trim() || null}, ${JSON.stringify(produkObj)}, ${sesiJson}, ${hargaJson}, ${vmapJson}, ${total})
      RETURNING id, nama, produk_json, sesi_json, harga_json, vmap_json, total, selesai, created_at
    `
    // Opsi A: barang bon uda DIAMBIL pembeli saat digantung → HOLD stok kini.
    // Kurangi stok per item (hold), GREATEST(0) cegah minus. Saat tebus (tandai
    // selesai) stok TIDAK dikurangi ulang — transaksi bon set `trx.bon_tebus_id`.
    // Item virtual (id < 0) tak punya row produk → dilewati.
    for (const [idStr, qty] of Object.entries(produkObj)) {
      if (Number(idStr) < 0) continue
      await t`
        UPDATE produk SET stok = GREATEST(0, stok - ${Number(qty)}), updated_at = now()
        WHERE id = ${Number(idStr)} AND toko_id = ${toko.tokoId}
      `
    }
    return r
  })
  // Audit: bon digantung (dari windows kasir via kirim_bon, atau halaman bon web).
  await catatAktivitas(toko, 'bon_gantung', `Bon Gantung #${row.id} atas nama ${body.nama?.trim() || '(tanpa nama)'} · Rp ${total.toLocaleString('id-ID')}`)
  return NextResponse.json({ ...row, produk: JSON.parse(row.produk_json), sesi: resolveSesi(row.sesi_json, row.produk_json, row.created_at) }, { status: 201 })
})
