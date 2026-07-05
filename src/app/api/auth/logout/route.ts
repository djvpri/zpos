import { NextResponse } from 'next/server'

export async function POST(_req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('zpos_token')
  return res
}
