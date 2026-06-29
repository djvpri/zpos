import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await sql`
    SELECT pajak_persen, alamat, telepon, catatan_struk
    FROM toko WHERE id = ${toko.tokoId}
  `
  return NextResponse.json({
    pajak_persen: row?.pajak_persen ?? 0,
    alamat: row?.alamat ?? '',
    telepon: row?.telepon ?? '',
    catatan_struk: row?.catatan_struk ?? '',
  })
}

export async function PUT(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { pajak_persen, alamat, telepon, catatan_struk } = await req.json()
  const persen = Math.round(Number(pajak_persen))
  if (!Number.isFinite(persen) || persen < 0 || persen > 100) {
    return NextResponse.json({ error: 'Pajak harus 0–100%' }, { status: 400 })
  }

  await sql`
    UPDATE toko SET
      pajak_persen = ${persen},
      alamat = ${alamat?.trim() || null},
      telepon = ${telepon?.trim() || null},
      catatan_struk = ${catatan_struk?.trim() || null}
    WHERE id = ${toko.tokoId}
  `
  return NextResponse.json({ pajak_persen: persen, alamat, telepon, catatan_struk })
}
