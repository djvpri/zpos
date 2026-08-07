import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { catatAktivitas } from '@/lib/aktivitas'
import type { Transaksi, DetailTransaksi } from '@/types'

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await statusToko(toko.tokoId)
  if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan. Hubungi admin.' }, { status: 403 })
  if (status.expired) return NextResponse.json({ error: 'Langganan sudah habis. Hubungi admin untuk memperpanjang.' }, { status: 403 })

  const { trx, items }: { trx: Transaksi; items: DetailTransaksi[] } = await req.json()

  // Kalau transaksi ini sudah pernah masuk (retry dari antrian offline yang
  // sempat sukses tapi responsnya tidak sampai ke client), kembalikan baris
  // yang sudah ada — supaya sinkronisasi ulang tidak gagal atau dobel.
  const [existing] = await sql`SELECT * FROM transaksi WHERE no_transaksi = ${trx.no_transaksi}`
  if (existing) return NextResponse.json(existing, { status: 409 })

  // Shift: kalau client kirim `trx.shift_id` (kasir Tauri, shift per kasir lokal),
  // validasi dulu — harus milik toko ini & masih aktif. Tidak valid → fallback
  // ke shift aktif user token (pakai web). Ini mencegah attach ke shift toko lain
  // atau shift yang sudah ditutup (transaksi offline lama tetap masuk, tanpa shift).
  let shiftId: number | null = null
  if (trx.shift_id) {
    const [s] = await sql`
      SELECT id FROM shift
      WHERE id = ${Number(trx.shift_id)} AND toko_id = ${toko.tokoId} AND aktif = true
      LIMIT 1
    `
    if (s) shiftId = s.id
  }
  if (shiftId === null) {
    const [activeShift] = await sql`
      SELECT id FROM shift WHERE toko_id = ${toko.tokoId} AND user_id = ${toko.userId} AND aktif = true LIMIT 1
    `
    shiftId = activeShift?.id ?? null
  }

  // created_at: kalau client kirim (mis. transaksi offline yang baru
  // tersinkron belakangan), pakai waktu jual SESUNGGUHNYA itu — bukan
  // waktu sinkron — supaya laporan harian tidak salah tanggal.
  const waktuJual = trx.created_at ? new Date(trx.created_at) : new Date()

  const [saved] = await sql`
    INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id, shift_id, created_at)
    VALUES (${trx.no_transaksi}, ${trx.subtotal}, ${trx.diskon}, ${trx.pajak}, ${trx.total},
            ${trx.bayar}, ${trx.kembali}, ${trx.metode_bayar}, ${toko.userName}, ${toko.tokoId}, ${shiftId}, ${waktuJual})
    RETURNING *
  `

  if (items.length > 0) {
    const rows = items.map(i => ({
      transaksi_id: saved.id as number,
      produk_id: i.produk_id,
      nama_produk: i.nama_produk,
      harga: i.harga,
      qty: i.qty,
      subtotal: i.subtotal,
      toko_id: toko.tokoId,
    }))
    await sql`INSERT INTO detail_transaksi ${sql(rows)}`
  }

  // Audit: catat transaksi baru (metode bayar + total, utk cek kecurangan).
  void catatAktivitas(toko, 'transaksi_buat',
    `${saved.no_transaksi} · ${trx.metode_bayar ?? '-'} · Rp ${Number(saved.total).toLocaleString('id-ID')} · ${items.length} item`)

  return NextResponse.json(saved)
}

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 20)
  const rows = await sql`
    SELECT * FROM transaksi WHERE toko_id = ${toko.tokoId} ORDER BY created_at DESC LIMIT ${limit}
  `
  return NextResponse.json(rows)
}
