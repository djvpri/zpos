import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function POST(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { produk } = body as { produk: Array<{
    nama: string; harga: number; stok: number; kategori: string;
    deskripsi?: string; barcode?: string; expired_at?: string; stok_minimum?: number; foto_url?: string
    harga_grosir?: number; min_qty_grosir?: number
  }> }

  if (!produk?.length) return NextResponse.json({ error: 'Data kosong' }, { status: 400 })

  let berhasil = 0
  let diupdate = 0
  let gagal = 0
  // Error per-baris: nomor baris di file Excel (+1 utk header), agar user bisa
  // langsung cari baris yang bermasalah tanpa buka ulang seluruh file.
  const errors: { baris: number; pesan: string }[] = []

  for (let i = 0; i < produk.length; i++) {
    const p = produk[i]
    const baris = i + 2 // baris di Excel: i=0 → baris 2 (baris 1 = header), dan seterusnya
    try {
      if (!p.nama || !p.harga) { gagal++; errors.push({ baris, pesan: 'Nama atau harga kosong' }); continue }

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

      // Upsert dengan dua kunci, urutannya:
      //  1) barcode cocok → UPDATE (harga/stok terbaru)
      //  2) tanpa barcode (atau tak ada cocok) tapi NAMA sama → UPDATE
      //     (produk dari mode cepat punya barcode internal, Excel manual bikin
      //     tanpa barcode; nama jadi kunci agar tak duplikat).
      //  3) baru/sama sekali tak cocok → INSERT.
      const hasBarcode = Boolean(p.barcode?.trim())
      const nama = p.nama.trim().toLowerCase()

      if (hasBarcode) {
        const [existing] = await sql`
          SELECT id FROM produk
          WHERE barcode = ${p.barcode!.trim()} AND toko_id = ${toko.tokoId}
          LIMIT 1
        `
        if (existing) {
          await sql`
            UPDATE produk SET
              nama = ${p.nama},
              harga = ${p.harga},
              stok = ${p.stok || 0},
              deskripsi = ${p.deskripsi || null},
              kategori_id = ${kategoriId},
              expired_at = ${p.expired_at || null},
              stok_minimum = ${p.stok_minimum || 5},
              harga_grosir = ${p.harga_grosir ?? null},
              min_qty_grosir = ${p.min_qty_grosir ?? null},
              aktif = true
            WHERE id = ${existing.id} AND toko_id = ${toko.tokoId}
          `
          diupdate++
          continue
        }
      }

      // Fallback by NAMA (case-insensitive): tanpa barcode / tak ada cocok barcode.
      const [byNama] = await sql`
        SELECT id FROM produk
        WHERE LOWER(TRIM(nama)) = ${nama} AND toko_id = ${toko.tokoId}
        LIMIT 1
      `
      if (byNama) {
        await sql`
          UPDATE produk SET
            harga = ${p.harga},
            stok = ${p.stok || 0},
            deskripsi = ${p.deskripsi || null},
            kategori_id = ${kategoriId},
            expired_at = ${p.expired_at || null},
            stok_minimum = ${p.stok_minimum || 5},
            harga_grosir = ${p.harga_grosir ?? null},
            min_qty_grosir = ${p.min_qty_grosir ?? null},
            aktif = true
          WHERE id = ${byNama.id} AND toko_id = ${toko.tokoId}
        `
        diupdate++
        continue
      }

      await sql`
        INSERT INTO produk (nama, harga, stok, emoji, deskripsi, barcode, foto_url, kategori_id, toko_id, expired_at, stok_minimum, aktif, harga_grosir, min_qty_grosir)
        VALUES (
          ${p.nama}, ${p.harga}, ${p.stok || 0}, ${'📦'},
          ${p.deskripsi || null}, ${p.barcode?.trim() || null}, ${p.foto_url || null},
          ${kategoriId}, ${toko.tokoId},
          ${p.expired_at || null}, ${p.stok_minimum || 5}, true,
          ${p.harga_grosir ?? null}, ${p.min_qty_grosir ?? null}
        )
      `
      berhasil++
    } catch (e: any) {
      gagal++
      errors.push({ baris, pesan: e.message?.slice(0, 100) || 'Kesalahan tak dikenal' })
    }
  }

  return NextResponse.json({ berhasil, diupdate, gagal, errors })
}
