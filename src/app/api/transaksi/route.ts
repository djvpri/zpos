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
  // validasi dulu — harus milik toko ini (boleh shift yang sudah tutup; transaksi
  // OFFLINE yang terkirim belakangan harus tetap masuk shift aslinya, walau shift
  // itu sudah ditutup berhari-hari lalu). Hanya cek toko_id, BUKAN `aktif=true`
  // (kasus offline seminggu/sebulan: tiap shift ditutup harian, tapi transaksi
  // offline menumpuk & harus menempel ke shift tanggal transaksi itu dibuatnya).
  // Kalau shift_id invalid/tak ada → fallback ke shift aktif user token (web).
  let shiftId: number | null = null
  if (trx.shift_id) {
    const [s] = await sql`
      SELECT id FROM shift
      WHERE id = ${Number(trx.shift_id)} AND toko_id = ${toko.tokoId}
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

  // Simpan transaksi + kurangi stok produk ATOMIC (satu transaksi DB). Stok
  // cuma produk asli (produk_id > 0); item virtual harga-bebas dilewati.
  const saved = await sql.begin(async t => {
    const [tr] = await t`
      INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id, shift_id, created_at)
      VALUES (${trx.no_transaksi}, ${trx.subtotal}, ${trx.diskon}, ${trx.pajak}, ${trx.total},
              ${trx.bayar}, ${trx.kembali}, ${trx.metode_bayar}, ${toko.userName}, ${toko.tokoId}, ${shiftId}, ${waktuJual})
      RETURNING *
    `
    if (items.length > 0) {
      const rows = items.map(i => ({
        transaksi_id: tr.id as number,
        produk_id: i.produk_id,
        nama_produk: i.nama_produk,
        harga: i.harga,
        qty: i.qty,
        subtotal: i.subtotal,
        toko_id: toko.tokoId,
      }))
      await t`INSERT INTO detail_transaksi ${t(rows)}`
      // Kurangi stok produk riil. Per item real (id>0). GREATEST(0) cegah minus.
      // KECUALI transaksi TEBUS bon gantung (`trx.bon_tebus_id`): stok bon sudah
      // di-hold (barang diambil pembeli) saat bon dibuat di POST /api/bon, jadi
      // tebus TIDAK boleh kurangi lagi (double). Akuntansi/shift tetap dicatat.
      const real = items.filter(i => Number(i.produk_id) > 0)
      if (!trx.bon_tebus_id) {
        for (const i of real) {
          await t`
            UPDATE produk SET stok = GREATEST(0, stok - ${Number(i.qty)}), updated_at = now()
            WHERE id = ${Number(i.produk_id)} AND toko_id = ${toko.tokoId}
          `
        }
      }
    }
    return tr
  })

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
