import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { isBarcodeValid, lookupBarcode } from '@/lib/barcode-lookup'

// Cache in-memory (module-level, satu instance per server) — scan berulang
// tak spam Open Food Facts. Logika murni lookup ada di lib/barcode-lookup.ts.

const cache = new Map<string, { data: Awaited<ReturnType<typeof lookupBarcode>>; at: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 jam

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const barcode = (url.searchParams.get('barcode') || '').trim()

  if (!barcode) return NextResponse.json({ error: 'barcode wajib' }, { status: 400 })
  if (!isBarcodeValid(barcode)) return NextResponse.json({ error: 'barcode tidak valid' }, { status: 400 })

  const cached = cache.get(barcode)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ barcode, ...cached.data })
  }

  const data = await lookupBarcode(barcode)
  cache.set(barcode, { data, at: Date.now() })

  return NextResponse.json({ barcode, ...data })
}
