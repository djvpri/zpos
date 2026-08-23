import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'
import { apiHandler } from '@/lib/api-handler'

// GET daftar bon. Default: yang masih aktif (selesai=false). ?semua=1 → termasuk dibayar.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const semua = new URL(req.url).searchParams.get('semua') === '1'
  const rows = await sql`
    SELECT id, nama, produk_json, total, selesai, created_at, dibayar_at
    FROM bon
    WHERE toko_id = ${toko.tokoId} ${semua ? sql`` : sql`AND selesai = false`}
    ORDER BY selesai ASC, created_at DESC
  `
  // parse JSON di server → klien langsung pakai Record<number, number>
  const out = rows.map(r => ({
    id: r.id,
    nama: r.nama,
    produk: JSON.parse(r.produk_json),   // {produk_id: qty}
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

export const POST = apiHandler(async (req: Request, body: { nama?: string | null; produk: Record<string, number>; total?: number }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entries = Object.entries(body.produk ?? {}).map(([id, qty]) => [Number(id), Number(qty)] as const)
    .filter(([id, qty]) => Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0)

  if (entries.length === 0) return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
  if (entries.length > KERANJANG_MAX) return NextResponse.json({ error: 'Terlalu banyak item (maks 50)' }, { status: 400 })

  // Pastikan semua produk milik toko ini (jaga integritas cross-toko).
  const ids = entries.map(([id]) => id)
  const owned = await sql`SELECT id FROM produk WHERE toko_id = ${toko.tokoId} AND id = ANY(${ids})`
  const ownedSet = new Set(owned.map(o => Number(o.id)))
  const valid = entries.filter(([id]) => ownedSet.has(id))
  if (valid.length === 0) return NextResponse.json({ error: 'Tidak ada produk valid' }, { status: 400 })

  // harga pakai harga saat ini? Simpan total sbg penanda; saat tarik dihitung ulang
  // dari harga produk terkini (fleksibel). Total disimpan utk list penanda.
  const total = Math.round(body.total ?? 0)
  const produkObj: Record<string, number> = {}
  for (const [id, qty] of valid) produkObj[String(id)] = qty

  const row = await sql.begin(async t => {
    const [r] = await t`
      INSERT INTO bon (toko_id, nama, produk_json, total)
      VALUES (${toko.tokoId}, ${body.nama?.trim() || null}, ${JSON.stringify(produkObj)}, ${total})
      RETURNING id, nama, produk_json, total, selesai, created_at
    `
    // Opsi A: barang bon uda DIAMBIL pembeli saat digantung → HOLD stok kini.
    // Kurangi stok per item (hold), GREATEST(0) cegah minus. Saat tebus (tandai
    // selesai) stok TIDAK dikurangi ulang — transaksi bon set `trx.bon_tebus_id`.
    for (const [idStr, qty] of Object.entries(produkObj)) {
      await t`
        UPDATE produk SET stok = GREATEST(0, stok - ${Number(qty)}), updated_at = now()
        WHERE id = ${Number(idStr)} AND toko_id = ${toko.tokoId}
      `
    }
    return r
  })
  // Audit: bon digantung (dari windows kasir via kirim_bon, atau halaman bon web).
  await catatAktivitas(toko, 'bon_gantung', `Bon #${row.id} atas nama ${body.nama?.trim() || '(tanpa nama)'} · Rp ${total.toLocaleString('id-ID')}`)
  return NextResponse.json({ ...row, produk: JSON.parse(row.produk_json) }, { status: 201 })
})
