import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { cariBarcode } from '@/lib/barcode-katalog'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ barcode: string }> },
) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const barcode = (await params).barcode.trim()
  if (!barcode) return NextResponse.json({ error: 'barcode wajib' }, { status: 400 })

  const data = await cariBarcode(barcode)
  if (!data) return NextResponse.json({ error: 'barcode tidak dikenal di katalog' }, { status: 404 })

  return NextResponse.json(data)
}
