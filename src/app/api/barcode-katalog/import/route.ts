import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Import massal barcode → katalog pusat (global). Frontend sudah meng-uraikan
// file Excel kl...barcode/nama (merek, kategori opsional). Admin-only — hanya
// pemilik/pengelola katalog yang boleh menambah data global.

const MAX_BARIS = 100_000

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 })

  const body = await req.json()
  const items = Array.isArray(body?.items) ? body.items : []

  if (!items.length) return NextResponse.json({ error: 'Data kosong' }, { status: 400 })
  if (items.length > MAX_BARIS) {
    return NextResponse.json({ error: `Terlalu banyak (maks ${MAX_BARIS} baris)` }, { status: 400 })
  }

  let berhasil = 0
  let gagal = 0
  const errors: { baris: number; pesan: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const baris = i + 2 // baris excel (baris 1 = header)
    const barcode = String(it?.barcode ?? '').trim()
    const nama = String(it?.nama ?? '').trim()
    if (!/^\d{8,13}$/.test(barcode) || !nama) {
      gagal++
      errors.push({ baris, pesan: 'Barcode (8-13 digit) atau nama kosong' })
      continue
    }
    try {
      await sql`
        INSERT INTO barcode_katalog (barcode, nama, merek, kategori, sumber)
        VALUES (${barcode}, ${nama.slice(0, 200)}, ${it?.merek?.trim() || null},
                ${it?.kategori?.trim() || null}, 'import')
        ON CONFLICT (barcode) DO UPDATE SET
          nama    = EXCLUDED.nama,
          merek   = COALESCE(EXCLUDED.merek, barcode_katalog.merek),
          kategori= COALESCE(EXCLUDED.kategori, barcode_katalog.kategori),
          sumber  = 'import'
      `
      berhasil++
    } catch (e) {
      gagal++
      errors.push({ baris, pesan: ((e as Error)?.message ?? '').slice(0, 100) })
    }
  }

  return NextResponse.json({ berhasil, gagal, errors })
}
