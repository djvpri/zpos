import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json(null, { status: 401 })
  return NextResponse.json({ email: admin.email })
}
