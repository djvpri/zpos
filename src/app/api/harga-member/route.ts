import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { hargaMemberSchema } from '@/lib/validation'
import { apiHandler } from '@/lib/api-handler'

// GET harga member utk kategori tertentu. Dipakai kasir saat member dipilih:
// return produk_id -> harga EFEKTIF (gabung harga tetap + diskon %, hanya utk
// produk yg berbeda dari normal). Query: ?kategori_member_id=N
// Dengan &mode=tetap: return produk_id -> harga TETAP SAJA (baris yang eksplisit
// di-set), dipakai UI MemberPage utk menampilkan/mengelola harga tetap.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = new URL(req.url)
  const katId = Number(u.searchParams.get('kategori_member_id'))
  const modeTetap = u.searchParams.get('mode') === 'tetap'
  if (!katId) return NextResponse.json({})

  // Pastikan kategori milik toko ini
  const [kat] = await sql`SELECT id, diskon_persen FROM kategori_member WHERE id = ${katId} AND toko_id = ${toko.tokoId}`
  if (!kat) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })

  if (modeTetap) {
    // Hanya baris harga tetap yang eksplisit di-set (override penuh di kasir).
    const tetap = await sql`
      SELECT produk_id, harga FROM harga_member
      WHERE kategori_member_id = ${katId} AND toko_id = ${toko.tokoId}
    `
    const m: Record<number, number> = {}
    for (const r of tetap) m[r.produk_id] = Math.round(r.harga)
    return NextResponse.json(m)
  }

  // Semua produk aktif milik toko + harga tetap khusus kategori (jika ada).
  const rows = await sql`
    SELECT p.id AS produk_id, p.harga AS harga_normal,
           hm.harga AS harga_tetap, ${kat.diskon_persen} AS diskon_persen
    FROM produk p
    LEFT JOIN harga_member hm
      ON hm.produk_id = p.id AND hm.kategori_member_id = ${katId} AND hm.toko_id = ${toko.tokoId}
    WHERE p.toko_id = ${toko.tokoId} AND p.aktif = true
  `

  //   map[r.produk_id] = Math.round(r.harga_tetap)
  //   2. diskon_persen != 0 (positif = diskon, negatif = markup) → harga × (1 - diskon/100)
  const map: Record<number, number> = {}
  for (const r of rows) {
    if (r.harga_tetap != null && r.harga_tetap > 0) {
      map[r.produk_id] = Math.round(r.harga_tetap)
    } else if (r.diskon_persen !== 0) {
      const faktor = 1 - r.diskon_persen / 100  // negatif => >1 (markup)
      map[r.produk_id] = Math.round(r.harga_normal * Math.max(faktor, 0))  // clamp >=0
    }
  }
  return NextResponse.json(map)
}

// POST set/update harga TETAP member untuk satu produk+kategori.
// Kirim { produkl_id, kategori_member_id, harga } (upsert). harga baru 0
// tidak diset (pakai diskon %), beri cara reset dengan kirim harga = null? 
// Harga null → hapus baris supaya turun ke diskon/normal. Konsisten & simpel.
export const POST = apiHandler(async (req: Request, body: { produk_id: number; kategori_member_id: number; harga: number }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Validasi semua milik toko ini
  const [kat] = await sql`SELECT id FROM kategori_member WHERE id = ${body.kategori_member_id} AND toko_id = ${toko.tokoId}`
  const [prod] = await sql`SELECT id FROM produk WHERE id = ${body.produk_id} AND toko_id = ${toko.tokoId}`
  if (!kat || !prod) return NextResponse.json({ error: 'Produk/kategori tidak valid' }, { status: 400 })

  const [row] = await sql`
    INSERT INTO harga_member (produk_id, kategori_member_id, toko_id, harga)
    VALUES (${body.produk_id}, ${body.kategori_member_id}, ${toko.tokoId}, ${body.harga})
    ON CONFLICT (produk_id, kategori_member_id)
    DO UPDATE SET harga = EXCLUDED.harga
    RETURNING id, produk_id, kategori_member_id, harga
  `
  return NextResponse.json(row, { status: 201 })
}, { schema: hargaMemberSchema })

// DELETE hapus harga tetap (reset ke diskon %/normal)
export async function DELETE(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const u = new URL(req.url)
  const produkId = Number(u.searchParams.get('produk_id'))
  const katId = Number(u.searchParams.get('kategori_member_id'))
  if (!produkId || !katId) return NextResponse.json({ error: 'Param tidak lengkap' }, { status: 400 })

  await sql`
    DELETE FROM harga_member WHERE produk_id = ${produkId} AND kategori_member_id = ${katId} AND toko_id = ${toko.tokoId}
  `
  return NextResponse.json({ ok: true })
}
