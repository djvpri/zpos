import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Tab Lisensi ZPos: gabungkan expiry tenant (lokal `toko`) + biaya & rekening
// perpanjangan (global, diatur admin di ZOne /manage — /api/settings publik).
const ZONE_URL = process.env.ZONE_URL || 'https://zone.zomet.my.id'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [row] = await sql`
      SELECT plan, langganan_sampai FROM toko WHERE id = ${toko.tokoId} LIMIT 1
    `

    // Ambil biaya & rekening dari Z One. Gagal -> null field (UI tampil
    // "belum diatur"/fallback cache), jangan gagalkan seluruh endpoint.
    let license = { cost: null, rek_bank: null, rek_nama: null, rek_no: null, whatsapp: null }
    try {
      const res = await fetch(`${ZONE_URL}/api/settings`, { cache: 'no-store' })
      if (res.ok) {
        const s = (await res.json()).settings || {}
        license = {
          cost: s.license_cost || null,
          rek_bank: s.license_rek_bank || null,
          rek_nama: s.license_rek_nama || null,
          rek_no: s.license_rek_no || null,
          whatsapp: s.license_whatsapp || null,
        }
      }
    } catch {
      // Z One down — biarkan field lisensi null
    }

    return NextResponse.json({
      plan: row?.plan || 'starter',
      expires_at: row?.langganan_sampai || null,
      ...license,
    })
  } catch (e) {
    console.error('GET /api/license error:', e)
    return NextResponse.json({ error: 'Gagal memuat lisensi' }, { status: 500 })
  }
}
