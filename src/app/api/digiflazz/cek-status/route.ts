import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getDigiflazzCronSecret } from '@/lib/secrets'
import { cekStatus, type DigiflazzRow } from '@/lib/digiflazz'

export const runtime = 'nodejs'

// Cron Digiflazz — finalisasi transaksi Pending yg webhook-nya tak datang.
// Dipanggil Railway Cron Job tiap N menit (mis. tiap 5 menit), BUKAN oleh
// sesi user. Proteksi secret di header (pola /api/demo/reset-daily).
//
// Safety net: webhook web adalah jalan utama; cron ini antisipasi callback
// yang telat/jatuh, supaya transaksi Pending tak nyangkut selamanya.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  let cocok: boolean
  try {
    cocok = token === getDigiflazzCronSecret()
  } catch {
    cocok = false
  }
  if (!cocok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // batasi sekali jalan (mis. 200) biar tak overload saat antrean menumpuk
  const pending = await sql`
    SELECT td.id, td.buyer_sku_code, td.ref_id, td.transaksi_id
    FROM transaksi_digital td
    WHERE td.status = 'Pending'
    ORDER BY td.id
    LIMIT 200
  `
  const hasil: { ref_id: string; dari: string; ke: string; sn?: string | null; message?: string | null }[] = []
  for (const p of pending) {
    try {
      const r = await cekStatus(p.buyer_sku_code, p.ref_id)
      const rd = (r?.data?.[0] ?? (r?.data as unknown) ?? {}) as DigiflazzRow
      const raw = String(rd.status ?? '').toLowerCase()
      const ke = raw === 'sukses' ? 'Sukses' : raw === 'pending' ? 'Pending' : 'Gagal'
      const sn = rd.sn ?? null
      const msg = rd.message ?? rd.desc ?? null
      const [td] = await sql`
        UPDATE transaksi_digital SET status = ${ke}, sn = ${sn}, message = ${msg}
        WHERE id = ${p.id} AND status = 'Pending'
        RETURNING transaksi_id
      `
      if (td && ke !== 'Pending') {
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
      hasil.push({ ref_id: p.ref_id, dari: 'Pending', ke, sn, message: msg })
    } catch {
      hasil.push({ ref_id: p.ref_id, dari: 'Pending', ke: 'Pending', message: 'cek-status error' })
    }
  }
  return NextResponse.json({ ok: true, diproses: pending.length, hasil })
}
