import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { produk } = body as { produk: Array<{
    nama: string; harga: number; stok: number; kategori: string;
    deskripsi?: string; barcode?: string; expired_at?: string; stok_minimum?: number
  }> }

  if (!produk?.length) return NextResponse.json({ error: 'Data kosong' }, { status: 400 })

  let berhasil = 0
  let gagal = 0
  const errors: string[] = []

  for (const p of produk) {
    try {
      if (!p.nama || !p.harga) { gagal++; errors.push(`Baris tanpa nama/harga dilewati`); continue }

      // Cari atau buat kategori
      let kategoriId: number | null = null
      if (p.kategori) {
        const [kat] = await sql`
          INSERT INTO kategori (nama, toko_id)
          VALUES (${p.kategori}, ${toko.tokoId})
          ON CONFLICT (nama, toko_id) DO UPDATE SET nama = EXCLUDED.nama
          RETURNING id
        `
        kategoriId = kat.id
      }

      await sql`
        INSERT INTO produk (nama, harga, stok, emoji, deskripsi, barcode, foto_url, kategori_id, toko_id, expired_at, stok_minimum, aktif)
        VALUES (
          ${p.nama}, ${p.harga}, ${p.stok || 0}, ${'📦'},
          ${p.deskripsi || null}, ${p.barcode || null}, ${(p as any).foto_url || null},
          ${kategoriId}, ${toko.tokoId},
          ${p.expired_at || null}, ${p.stok_minimum || 5}, true
        )
        ON CONFLICT DO NOTHING
      `
      berhasil++
    } catch (e: any) {
      gagal++
      errors.push(`${p.nama}: ${e.message?.slice(0, 50)}`)
    }
  }

  return NextResponse.json({ berhasil, gagal, errors: errors.slice(0, 5) })
}
