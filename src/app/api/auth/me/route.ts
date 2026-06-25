import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json(null, { status: 401 })
  const status = await statusToko(toko.tokoId)

  const responseData = {
    ...toko,
    plan: status.plan,
    langganan_sampai: status.langganan_sampai,
    aktif: status.aktif,
    expired: status.expired,
  }

  const res = NextResponse.json(responseData)

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
