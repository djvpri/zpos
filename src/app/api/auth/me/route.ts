import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json(null, { status: 401 })
  return NextResponse.json(toko)
}
