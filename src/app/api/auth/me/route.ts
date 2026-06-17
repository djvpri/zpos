import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json(null, { status: 401 })
  const status = await statusToko(toko.tokoId)
  return NextResponse.json({
    ...toko,
    plan: status.plan,
    langganan_sampai: status.langganan_sampai,
    aktif: status.aktif,
    expired: status.expired,
  })
}
