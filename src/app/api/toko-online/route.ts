import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { validSubdomain, isValidWa, normalisasiWa } from '@/lib/toko-online'

export interface TokoOnlineBody {
  subdomain?: string | null
  toko_online_aktif?: boolean
  wa_toko_online?: string | null
}

// GET /api/toko-online — baca status toko online saat ini (owner/admin).
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await sql`
    SELECT subdomain, toko_online_aktif, wa_toko_online
    FROM toko WHERE id = ${toko.tokoId}
  `
  return NextResponse.json({
    subdomain: row?.subdomain ?? null,
    toko_online_aktif: row?.toko_online_aktif ?? false,
    wa_toko_online: row?.wa_toko_online ?? null,
  })
}

// PUT /api/toko-online — simpan subdomain, WA, toggle.
export const PUT = apiHandler(async (req: Request, body: TokoOnlineBody) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const subdomain = body.subdomain?.trim() || null
  const aktif = body.toko_online_aktif === true
  const wa = body.wa_toko_online ? normalisasiWa(body.wa_toko_online) : null

  // Validasi bila ingin menyimpan subdomain / mengaktifkan
  if (subdomain) {
    const v = validSubdomain(subdomain)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  }
  if (wa && !isValidWa(wa)) {
    return NextResponse.json({ error: 'Nomor WhatsApp tidak valid' }, { status: 400 })
  }

  // Cek bentrok subdomain (ada toko lain pakai subdomain sama)
  if (subdomain) {
    const [bentrok] = await sql`
      SELECT id FROM toko
      WHERE LOWER(subdomain) = LOWER(${subdomain}) AND id <> ${toko.tokoId}
    `
    if (bentrok) return NextResponse.json({ error: 'Subdomain sudah dipakai toko lain' }, { status: 409 })
  }

  await sql`
    UPDATE toko SET
      subdomain = ${subdomain},
      toko_online_aktif = ${aktif},
      wa_toko_online = ${wa}
    WHERE id = ${toko.tokoId}
  `

  return NextResponse.json({ ok: true, subdomain, toko_online_aktif: aktif, wa_toko_online: wa })
})
