import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// GET /api/admin/diagnosa?toko_id=8
// Snapshot satu-panggilan: health toko, stuck bon, sync error, device status,
// transaksi terbaru, langganan. Admin-only. Dirancang utk AI agent cek cepat.
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tokoId = url.searchParams.get('toko_id')
  const days = Math.min(Number(url.searchParams.get('days') ?? 7), 30)

  // ── Semua toko (overview) jika tanpa toko_id ──
  if (!tokoId) {
    const tokos = await sql`
      SELECT t.id, t.nama, t.plan, t.aktif, t.langganan_sampai,
        (SELECT count(*)::int FROM bon b WHERE b.toko_id = t.id AND b.selesai = false) AS bon_aktif,
        (SELECT count(*)::int FROM transaksi tr WHERE tr.toko_id = t.id AND tr.created_at > now() - interval '1 day') AS trx_24h,
        (SELECT count(*)::int FROM log_kasir lk WHERE lk.toko_id = t.id AND lk.konten ~* 'gagal|error' AND lk.created_at > now() - interval '1 day') AS err_24h,
        (SELECT max(lk.created_at) FROM log_kasir lk WHERE lk.toko_id = t.id) AS last_sync
      FROM toko t ORDER BY t.id
    `
    return NextResponse.json({ overview: tokos })
  }

  const tid = Number(tokoId)
  if (!Number.isInteger(tid)) return NextResponse.json({ error: 'toko_id tidak valid' }, { status: 400 })

  // ── Detail per toko ──
  const [toko] = await sql`
    SELECT id, nama, plan, aktif, subdomain, desain_nota, kurangi_stok, jual_stok_habis,
           langganan_sampai, created_at
    FROM toko WHERE id = ${tid}
  `
  if (!toko) return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 })

  // Bon gantung aktif + item count
  const bonAktif = await sql`
    SELECT b.id, b.nama, b.total, b.created_at,
      (SELECT count(*)::int FROM jsonb_object_keys(b.produk_json::jsonb)) AS item_count,
      b.selesai
    FROM bon b WHERE b.toko_id = ${tid} AND b.selesai = false
    ORDER BY b.created_at DESC LIMIT 20
  `

  // Sync error 7 hari
  const syncErrors = await sql`
    SELECT id, device_id, LEFT(konten, 500) AS konten, created_at
    FROM log_kasir
    WHERE toko_id = ${tid} AND konten ~* 'gagal|error|panic'
      AND created_at > now() - interval '${days} days'
    ORDER BY created_at DESC LIMIT 20
  `

  // Device health
  const devices = await sql`
    SELECT device_id, max(nama_pc) AS nama_pc,
      count(*)::int AS total_logs,
      (count(*) FILTER (WHERE konten ~* 'sync OK'))::int AS sync_ok,
      (count(*) FILTER (WHERE konten ~* 'GAGAL|error'))::int AS errors,
      max(created_at) AS last_seen
    FROM log_kasir WHERE toko_id = ${tid}
    GROUP BY device_id ORDER BY last_seen DESC
  `

  // Transaksi terbaru
  const trxRecent = await sql`
    SELECT t.id, t.total, t.created_at, u.nama AS kasir
    FROM transaksi t
    JOIN "user" u ON u.id = t.user_id
    WHERE t.toko_id = ${tid}
    ORDER BY t.created_at DESC LIMIT 10
  `

  // Stat ringkas
  const [stats] = await sql`
    SELECT
      (SELECT count(*)::int FROM produk WHERE toko_id = ${tid}) AS produk_count,
      (SELECT count(*)::int FROM "user" WHERE toko_id = ${tid} AND aktif = true) AS user_count,
      (SELECT count(*)::int FROM member WHERE toko_id = ${tid}) AS member_count,
      (SELECT count(*)::int FROM transaksi WHERE toko_id = ${tid} AND created_at > now() - interval '1 day') AS trx_24h,
      (SELECT COALESCE(sum(total), 0)::bigint FROM transaksi WHERE toko_id = ${tid} AND created_at > now() - interval '1 day') AS omzet_24h,
      (SELECT count(*)::int FROM bon WHERE toko_id = ${tid} AND selesai = false) AS bon_gantung_count,
      (SELECT count(*)::int FROM log_kasir WHERE toko_id = ${tid} AND konten ~* 'gagal|error' AND created_at > now() - interval '1 day') AS err_24h
  `

  // Langganan status
  const langgananAktif = toko.langganan_sampai ? new Date(toko.langganan_sampai) > new Date() : false
  const langgananHari = toko.langganan_sampai
    ? Math.ceil((new Date(toko.langganan_sampai).getTime() - Date.now()) / 86400000)
    : null

  // ── Error log 24 jam dari error_log table (AI-agent-friendly) ──
  // Group by fingerprint → top error patterns dgn count + sample.
  let errorSummary: unknown[] = []
  try {
    const rows = await sql`
      SELECT fingerprint, code, route, method, status,
             count(*)::int AS hits,
             max(ts) AS last_ts,
             min(message) AS sample_message,
             min(param) AS sample_param
      FROM error_log
      WHERE ts > now() - interval '24 hours'
        AND (device_id IS NULL OR device_id = '')
      GROUP BY fingerprint, code, route, method, status
      ORDER BY hits DESC
      LIMIT 10
    `
    errorSummary = rows as unknown[]
  } catch {
    // error_log belum ada (sebelum migrate jalan) — skip gracefully
    errorSummary = []
  }

  return NextResponse.json({
    toko,
    langganan: { aktif: langgananAktif, hari_tersisa: langgananHari },
    stats,
    bon_gantung: bonAktif,
    sync_errors: syncErrors,
    devices,
    transaksi_terbaru: trxRecent,
    error_summary: errorSummary,
  })
}
