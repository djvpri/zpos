import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { DigiflazzRow } from '@/lib/digiflazz'

export const runtime = 'nodejs'

// Webhook Digiflazz — dipanggil Digiflazz saat status transaksi Pending
// resolve menjadi Sukses/Gagal (callback). Route publik (Digiflazz kirim
// tanpa token), tapi hanya memutasi baris `transaksi_digital` yang ref_id-nya
// MATCH & status masih Pending di DB — jadi tak bisa dipakai mengubah
// transaksi sembarangan (attacker tak punya ref_id valid).
//
// Payload Digiflazz (webhook prabayar), data[0] adalah objek transaksi:
//   { ref_id, buyer_sku_code, customer_no, status, sn?, message?, rc }
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }
  const dataArr = body.data
  const d = (Array.isArray(dataArr) ? dataArr[0] : dataArr ?? {}) as DigiflazzRow
  const refId = d.ref_id ?? d.refid
  if (!refId) return NextResponse.json({ ok: false, pesan: 'tidak ada ref_id' }, { status: 422 })

  const [row] = await sql`
    SELECT id FROM transaksi_digital
    WHERE ref_id = ${String(refId)} AND status = 'Pending'
    LIMIT 1
  `
  if (!row) {
    // ref_id tak dikenal / sudah final — bukan alur kita, abaikan diam-diam
    return NextResponse.json({ ok: true, pesan: 'ignore' })
  }

  const raw = String(d.status ?? '').toLowerCase()
  const final = raw === 'sukses' ? 'Sukses' : raw === 'pending' ? 'Pending' : 'Gagal'
  const sn = d.sn ?? null
  const msg = d.message ?? d.desc ?? null

  const [td] = await sql`
    UPDATE transaksi_digital
    SET status = ${final}, sn = ${sn}, message = ${msg}
    WHERE id = ${row.id} AND status = 'Pending'
    RETURNING transaksi_id, ref_id, harga_debet
  `
  // Refund saldo tenant bila transaksi berubah → Gagal (kredit balik yg sudah
  // didebit saat trx dibuat + catat riwayat).
  if (td && final === 'Gagal' && Number(td.harga_debet) > 0) {
    const [trx] = await sql`SELECT toko_id FROM transaksi WHERE id = ${td.transaksi_id}`
    if (trx) {
      await sql.begin(async t => {
        await t`UPDATE toko SET saldo = saldo + ${Number(td.harga_debet)} WHERE id = ${trx.toko_id}`
        await t`INSERT INTO toko_deposit (toko_id, nominal, tipe, keterangan)
                VALUES (${trx.toko_id}, ${Number(td.harga_debet)}, 'refund', ${`refund pulsa gagal #${td.ref_id}`})`
      })
    }
  }
  if (td) {
    // sinkronkan status induk transaksi: kalau semua digital-nya final & tak ada
    // yg Gagal → Sukses; kalau ada Gagal → Gagal.
    await sql`
      UPDATE transaksi SET status = (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM transaksi_digital t2 WHERE t2.transaksi_id = ${td.transaksi_id} AND t2.status = 'Pending') THEN 'Pending'
          WHEN EXISTS (SELECT 1 FROM transaksi_digital t2 WHERE t2.transaksi_id = ${td.transaksi_id} AND t2.status = 'Gagal') THEN 'Gagal'
          ELSE 'Sukses'
        END
      ) WHERE id = ${td.transaksi_id}
    `
  }
  return NextResponse.json({ ok: true })
}
