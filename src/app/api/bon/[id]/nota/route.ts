import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { grupDariSesi, parseSesiJson, normalVmap, type VMapEntry } from '@/lib/bon-sesi'

// Ambil detail nota bon utk dicetak: resolve produk_json (id→qty) ke
// daftar item {nama, harga, qty, subtotal}.
//
// KEBIJAKAN HARGA (2 tingkat):
//  - Bon punya riwayat grup ber-harga (`sesi_json[].h`) → nota tampilkan baris
//    PER GRUP. Tiap grup memakai harga saat grup itu dibuat, jadi nota
//    mencerminkan harga yg benar-benar disepakati waktu barang masuk.
//  - Bon tanpa `h` (dibuat sebelum kasir kirim h / dari web) → SERAGAM di
//    harga terkunci `harga_json` (fallback harga katalog). Nota lama tak berubah.
//
// `items` (flat) TETAP dikirim sbagai ringkasan per produk — dipakai edit bon,
// export Excel, & jumlah baris. `grup` hanya keterangan tambahan utk tampilan.
//
// TRANSPARANSI TOTAL: `total` = jumlah baris yang ditampilkan. Bila beda dgn
// `bon.total` tersimpan (mis. harga lama berubah), `totalTercatat` diisi angka
// tersimpan itu supaya nota bisa menandai selisihnya.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID bon tidak valid' }, { status: 400 })

  const [bon] = await sql`
    SELECT id, nama, produk_json, sesi_json, harga_json, vmap_json, total, selesai, created_at, dibayar_at
    FROM bon
    WHERE id = ${id} AND toko_id = ${toko.tokoId}`

  if (!bon) return NextResponse.json({ error: 'Bon tidak ditemukan' }, { status: 404 })

  const produk: Record<number, number> = JSON.parse(bon.produk_json)
  const ids = Object.keys(produk).map(Number)
  // Harga terkunci per produk (kalau ada) — acuan utama nota.
  let hargaKunci: Record<string, number> = {}
  try { hargaKunci = bon.harga_json ? JSON.parse(bon.harga_json) : {} } catch { hargaKunci = {} }
  // vmap = {idVirtual: {nama, harga}} → nama baris item "Lainnya" (id negatif).
  let vmapJson: unknown = null
  try { vmapJson = bon.vmap_json ? JSON.parse(bon.vmap_json) : null } catch { vmapJson = null }
  const vmap: Record<string, VMapEntry> = normalVmap(vmapJson)

  // Detail produk milik toko ini utk nama & harga nota (item virtual tak ada).
  const idsAsli = ids.filter(n => n > 0)
  let produkInfo: { id: number; nama: string; harga: number }[] = []
  if (idsAsli.length) {
    produkInfo = await sql`
      SELECT id, nama, harga
      FROM produk
      WHERE id = ANY(${idsAsli}) AND toko_id = ${toko.tokoId}`
  }
  const info = new Map(produkInfo.map(p => [Number(p.id), p]))
  const namaDari = (id: number): string =>
    id < 0 ? (vmap[String(id)]?.nama ?? `Produk #${id}`) : (info.get(id)?.nama ?? `Produk #${id}`)
  const hargaDari = (id: number): number =>
    id < 0 ? (vmap[String(id)]?.harga ?? 0) : Number(hargaKunci[String(id)] ?? info.get(id)?.harga ?? 0)

  const items = ids.map(id => {
    const qty = produk[id]
    const harga = hargaDari(id)
    return { produk_id: id, nama: namaDari(id), harga, qty, subtotal: Math.round(harga * qty) }
  })

  // Riwayat grup ber-harga: hanya dipakai bila SETIAP grup punya `h`. Bon campur
  // (sebagian grup tanpa h) → null → nota pakai mode seragam di bawah.
  const sesi = parseSesiJson(bon.sesi_json)
  const grup = grupDariSesi(sesi, produk, namaDari, hargaDari)

  // Total dihitung dari baris yang ditampilkan — jamin footer nota = jumlah baris.
  // Mode grup: jumlah grup. Mode seragam: jumlah items. `bon.total` dipakai hanya
  // bila tak ada item (bon kosong / produk terhapus).
  const jumlahBaris = grup
    ? grup.reduce((a, g) => a + g.subtotal, 0)
    : items.reduce((a, it) => a + it.subtotal, 0)
  const total = (grup || items.length) ? jumlahBaris : Number(bon.total ?? 0)
  // Angka tersimpan di kolom `bon.total` — dikirim terpisah supaya nota bisa
  // menandai selisih (harga historis berubah / total dikirim klien).
  const totalTercatat = Number(bon.total ?? 0)

  return NextResponse.json({
    id: bon.id,
    nama: bon.nama,
    total,
    totalTercatat,
    grup,
    selesai: bon.selesai,
    created_at: bon.created_at,
    dibayar_at: bon.dibayar_at,
    items,
  })
}
