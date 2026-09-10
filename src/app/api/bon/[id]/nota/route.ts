import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { resolveSesi, deltaPositif } from '@/lib/bon-sesi'

// Ambil detail nota bon utk dicetak: resolve produk_json (id→qty) ke
// daftar item {nama, harga, qty, subtotal}. Prioritas harga:
//   1. harga PER-SESI (`sesi_json[].h[produk]`) — harga saat grup itu dibuat.
//   2. harga terkunci bon (`harga_json`, Opsi A) — bon lama / tanpa rincian sesi.
//   3. harga katalog terkini — bon lama tanpa harga_json.
// Jadi grup lama bisa tetap Rp21.000 walau katalog kini Rp15.000, sementara
// tambahan baru (grup baru) dicatat di harga katalog saat barang ditambahkan.

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

  // Sesi eksplisit (tambahan ulang gagal) dari sesi_json bila ada. Kalau >1 (barang pernah
  // ditambahkan terpisah dari waktu pembuatan), nota dicetak per-sesi biar pembeli tak bingung.
  const daftarSesi = resolveSesi(bon.sesi_json, bon.produk_json, bon.created_at)

  // Harga efektif satuan per produk utk `items` flat. PENTING: `s.p` = qty KUMULATIF
  // (snapshot penuh) → qty per grup = DELTA positif dari grup sebelumnya. Bila harga
  // beda antar grup (produk sama, grup lama lebih mahal) → RATA-RATA TERTIMBANG.
  const hargaEfektif = (pid: number): number => {
    let q = 0, sum = 0
    for (let i = 0; i < daftarSesi.length; i++) {
      const s = daftarSesi[i]
      const prev = i === 0 ? null : daftarSesi[i - 1].p
      const d = i === 0 ? Number(s.p[String(pid)] || 0) : Number(deltaPositif(prev ?? {}, s.p)[String(pid)] || 0)
      if (d <= 0) continue
      const hs = s.h ? Number(s.h[String(pid)]) : NaN
      const h = Number.isFinite(hs) ? hs : (hargaKunci[String(pid)] != null ? Number(hargaKunci[String(pid)]) : (info.get(pid)?.harga ?? 0))
      q += d; sum += h * d
    }
    if (q > 0) return sum / q
    const kunci = hargaKunci[String(pid)]
    return (kunci != null && Number.isFinite(Number(kunci))) ? Number(kunci) : (info.get(pid)?.harga ?? 0)
  }

  const items = ids.map(id => {
    const p = info.get(id)
    const qty = produk[id]
    const harga = Math.round(hargaEfektif(id))
    return { produk_id: id, nama: p?.nama ?? `Produk #${id}`, harga, qty, subtotal: Math.round(harga * qty) }
  })
  let grup: {
    t: string
    sesiNo: number
    awal: boolean
    items: { produk_id: number; nama: string; harga: number; qty: number; subtotal: number }[]
  }[] | null = null
  if (daftarSesi.length > 1) {
    grup = daftarSesi.map((s, i) => {
      const prev = i === 0 ? null : daftarSesi[i - 1].p
      const mapQty = i === 0 ? s.p : deltaPositif(prev ?? {}, s.p)
      const list = Object.entries(mapQty)
        .map(([pidStr, qty]) => {
          const pid = Number(pidStr)
          const p = info.get(pid)
          const hs = s.h ? Number(s.h[String(pid)]) : NaN
          const kunci = Number.isFinite(hs) ? hs : hargaKunci[String(pid)]
          const harga = (kunci != null && Number.isFinite(Number(kunci))) ? Number(kunci) : (p?.harga ?? 0)
          return {
            produk_id: pid,
            nama: p?.nama ?? `Produk #${pid}`,
            harga,
            qty,
            subtotal: Math.round(harga * qty),
          }
        })
        .filter(it => it.qty > 0)
      return { t: s.t, sesiNo: i + 1, awal: i === 0, items: list }
    })
  }

  return NextResponse.json({
    id: bon.id,
    nama: bon.nama,
    total: bon.total,
    selesai: bon.selesai,
    created_at: bon.created_at,
    dibayar_at: bon.dibayar_at,
    items,
    grup,
  })
}
