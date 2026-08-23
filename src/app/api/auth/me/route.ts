import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import sql from '@/lib/db'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json(null, { status: 401 })
  const status = await statusToko(toko.tokoId)

  // Nama toko dari DB fresh, BUKAN dari token. Token bernama toko di-sign saat
  // login & bisa stale 30 hari (nama toko diganti di web tak ter-reflect) →
  // kasir pun tampil nama lama (mis "pTOSERBA..." yg sudah diperbaiki di web).
  let namaToko = toko.nama
  try {
    const rows = await sql`SELECT nama FROM toko WHERE id = ${toko.tokoId} LIMIT 1`
    if (rows.length && rows[0].nama) namaToko = rows[0].nama
  } catch { /* fallback token */ }

  const responseData = {
    ...toko,
    nama: namaToko,
    plan: status.plan,
    langganan_sampai: status.langganan_sampai,
    aktif: status.aktif,
    expired: status.expired,
    isDemo: status.isDemo,
  }

  const res = NextResponse.json(responseData, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  })

  // Re-issue token jika role sudah berubah di DB (agar cookie ter-update)
  if (toko._roleUpdated) {
    const { signToken } = await import('@/lib/auth')
    const newToken = await signToken({
      userId: toko.userId,
      tokoId: toko.tokoId,
      nama: toko.nama,
      userName: toko.userName,
      email: toko.email,
      plan: toko.plan,
      role: toko.role,
    })
    res.cookies.set('zpos_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }

  return res
}
