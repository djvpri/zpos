import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'

// Auto-upload log error z1 kasir → DB. Dipanggil kasir (Tauri) tiap file
// zpos-errors.log bertambah (delta baris). Auth = toko (cookie zpos_token).
// Retensi: hapus otomatis baris kelamaan (>12 jam) sekali per panggilan —
// murah & tanpa cron khusus (kasir upload tipis; row basi minimal).
const MAX_LINEN = 60_000 // jaga jangan biar isi tak kebesaran
const MAX_KONTEN = 200_000 // ~200KB per upload (delta error biasanya kecil)

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // cleanup baris kelamaan dari 12 jam (sekali per panggilan, non-blokir)
  try {
    await sql`DELETE FROM log_kasir WHERE created_at < now() - interval '12 hours'`
  } catch { /* non-blokir */ }

  let body: { device_id?: unknown; nama_pc?: unknown; konten?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const device_id = String(body.device_id ?? '').trim().slice(0, 100)
  const nama_pc = String(body.nama_pc ?? '').trim().slice(0, 200)
  const konten = String(body.konten ?? '').trim()
  if (!device_id || !konten) {
    return NextResponse.json({ error: 'device_id & konten wajib' }, { status: 400 })
  }
  let kontenClip = konten
  const nL = konten.split('\n').length
  if (nL > MAX_LINEN) kontenClip = konten.split('\n').slice(-MAX_LINEN).join('\n')
  if (kontenClip.length > MAX_KONTEN) kontenClip = kontenClip.slice(-MAX_KONTEN)

  // dedup ringan: jangan simpan persis baris yang sudah ada utk device+toko sama
  const [dupe] = await sql`
    SELECT 1 FROM log_kasir
    WHERE toko_id = ${toko.tokoId} AND device_id = ${device_id}
      AND konten = ${kontenClip}
      AND created_at > now() - interval '30 minutes'
    LIMIT 1
  `
  if (dupe) return NextResponse.json({ ok: true, dedup: true })

  await sql`
    INSERT INTO log_kasir (toko_id, device_id, nama_pc, konten)
    VALUES (${toko.tokoId}, ${device_id}, ${nama_pc || null}, ${kontenClip})
  `
  return NextResponse.json({ ok: true })
}

// (bacaan ringan utk diagnosa) optional — read oleh owner via DB/admin langsung,
// endpoint ini fokus tulis. Baca admin opsional di fitur lanjutan.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`
    SELECT id, device_id, nama_pc, konten, created_at
    FROM log_kasir
    WHERE toko_id = ${toko.tokoId} AND created_at > now() - interval '12 hours'
    ORDER BY id DESC LIMIT 50
  `
  return NextResponse.json({ rows })
}
