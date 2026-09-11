import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Ambil detail nota bon utk dicetak: resolve produk_json (id→qty) ke
// daftar item {nama, harga, qty, subtotal}.
//
// KEBIJAKAN HARGA: bon dinilai SERAGAM di harga terkunci terakhir (`harga_json`).
// Semua qty ikut harga itu, termasuk pcs yang masuk waktu harga masih lain —
// jadi jumlah baris nota SELALU = kolom `total` bon. Histori `sesi_json` tetap
// ada tapi TIDAK ditampilkan sebagai baris terpisah (dulu menampilkan delta
// per-sesi, sehingga baris tak pernah menjumlah jadi `total`).
// Urutan fallback harga: harga_json → harga katalog terkini.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID bon tidak valid' }, { status: 400 })

  const [bon] = await sql`
    SELECT id, nama, produk_json, sesi_json, harga_json, total, selesai, created_at, dibayar_at
    FROM bon
    WHERE id = ${id} AND toko_id = ${toko.tokoId}`

  if (!bon) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  const produk: Record<number, number> = JSON.parse(bon.produk_json)
  const ids = Object.keys(produk).map(Number)
  // Harga terkunci per produk (kalau ada) — acuan utama nota.
  let hargaKunci: Record<string, number> = {}
  try { hargaKunci = bon.harga_json ? JSON.parse(bon.harga_json) : {} } catch { hargaKunci = {} }

  // Detail produk milik toko ini utk nama & harga nota.
  let produkInfo: { id: number; nama: string; harga: number }[] = []
  if (ids.length) {
    produkInfo = await sql`
      SELECT id, nama, harga
      FROM produk
      WHERE id = ANY(${ids}) AND toko_id = ${toko.tokoId}`
  }
  const info = new Map(produkInfo.map(p => [Number(p.id), p]))

  const items = ids.map(id => {
    const p = info.get(id)
    const qty = produk[id]
    const kunci = hargaKunci[String(id)]
    const harga = (kunci != null && Number.isFinite(Number(kunci))) ? Number(kunci) : (p?.harga ?? 0)
    return { produk_id: id, nama: p?.nama ?? `Produk #${id}`, harga, qty, subtotal: Math.round(harga * qty) }
  })

  // Total dihitung dari baris yang ditampilkan — jamin footer nota = jumlah baris.
  // `bon.total` dipakai hanya bila tak ada item (bon kosong / produk terhapus).
  const jumlahBaris = items.reduce((a, it) => a + it.subtotal, 0)
  const total = items.length ? jumlahBaris : Number(bon.total ?? 0)

  return NextResponse.json({
    id: bon.id,
    nama: bon.nama,
    total,
    selesai: bon.selesai,
    created_at: bon.created_at,
    dibayar_at: bon.dibayar_at,
    items,
  })
}
