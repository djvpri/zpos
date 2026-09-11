import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { validasiItemVirtual } from '@/lib/item-virtual'

// Katalog item virtual per-tenant: item "Lainnya" yang DIBAGI antar kasir dalam
// satu toko. Kasir A menambah "Ayam / 20000" → kasir B bisa langsung memakainya.
// Berdiri sendiri, BUKAN baris `produk`: item virtual tak punya stok, barcode,
// foto, maupun kategori — menumpangkannya di `produk` memaksa penyaringan di
// hitung stok, stock-opname, sync 6000 produk, dan limit trial.
//
// Item dadakan yang tetap diketik manual TIDAK masuk sini — itu tetap id negatif
// (vidVirtual) + vmap pada bon.

// Pindahkan auto-migrate ke helper supaya POST/PATCH/DELETE juga aman — kasir
// bisa menambah preset sebelum GET pertama kali dijalankan.

export async function pastikanTabel() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS item_virtual (
      id serial PRIMARY KEY,
      toko_id int NOT NULL,
      nama text NOT NULL,
      harga int NOT NULL,
      aktif boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await sql.unsafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_item_virtual_unik ON item_virtual(toko_id, lower(nama))')
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_item_virtual_toko ON item_virtual(toko_id, nama) WHERE aktif = true')
}

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auto-migrate idempotent — sama pola `vmap_json` di /api/bon.
  // `nama` unik per toko supaya kasir tak bikin "Ayam" dua kali.
  await pastikanTabel()

  // Hanya yang aktif — item nonaktif tetap tersimpan supaya bon lama masih bisa
  // me-resolve namanya, tapi tak ditawarkan lagi di dialog "Lainnya".
  const rows = await sql`
    SELECT id, nama, harga FROM item_virtual
    WHERE toko_id = ${toko.tokoId} AND aktif = true
    ORDER BY nama
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await pastikanTabel()

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON' }, { status: 400 })
  }

  const v = validasiItemVirtual(raw)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { nama, harga } = v.nilai

  try {
    const [row] = await sql`
      INSERT INTO item_virtual (toko_id, nama, harga)
      VALUES (${toko.tokoId}, ${nama}, ${harga})
      RETURNING id, nama, harga
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') {
      // Sudah ada (aktif atau tidak) → hidupkan lagi sambil perbarui harga.
      const [row] = await sql`
        UPDATE item_virtual SET harga = ${harga}, aktif = true, updated_at = now()
        WHERE toko_id = ${toko.tokoId} AND lower(nama) = lower(${nama})
        RETURNING id, nama, harga
      `
      return NextResponse.json(row, { status: 200 })
    }
    console.error('item-virtual POST error', e)
    return NextResponse.json({ error: 'Gagal menyimpan item' }, { status: 500 })
  }
}
