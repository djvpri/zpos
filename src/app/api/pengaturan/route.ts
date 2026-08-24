import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { pengaturanSchema } from '@/lib/validation'
import { desainNotaIds } from '@/lib/desain-nota'
import { apiHandler } from '@/lib/api-handler'

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auto-migrasi idempotent — kolom baru biar ada tanpa tuner manual.
  await sql.unsafe("ALTER TABLE toko ADD COLUMN IF NOT EXISTS desain_nota text NOT NULL DEFAULT 'klasik'")

  const [row] = await sql`
    SELECT pajak_persen, alamat, telepon, catatan_struk, ukuran_label, desain_nota
    FROM toko WHERE id = ${toko.tokoId}
  `
  return NextResponse.json({
    pajak_persen: row?.pajak_persen ?? 0,
    alamat: row?.alamat ?? '',
    telepon: row?.telepon ?? '',
    catatan_struk: row?.catatan_struk ?? '',
    ukuran_label: row?.ukuran_label ?? '50x30',
    desain_nota: row?.desain_nota ?? 'klasik',
  })
}

export const PUT = apiHandler(async (req: Request, body: { pajak_persen?: number; alamat?: string | null; telepon?: string | null; catatan_struk?: string | null; ukuran_label?: string | null; desain_nota?: string | null }) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Auto-migrasi idempotent — sama seperti di GET.
  await sql.unsafe("ALTER TABLE toko ADD COLUMN IF NOT EXISTS desain_nota text NOT NULL DEFAULT 'klasik'")

  const { pajak_persen, alamat, telepon, catatan_struk, ukuran_label, desain_nota } = body
  const persen = Math.round(Number(pajak_persen ?? 0))
  if (!Number.isFinite(persen) || persen < 0 || persen > 100) {
    return NextResponse.json({ error: 'Pajak harus 0–100%' }, { status: 400 })
  }
  if (desain_nota != null && !desainNotaIds.includes(desain_nota)) {
    return NextResponse.json({ error: 'Desain nota tidak dikenal' }, { status: 400 })
  }

  await sql`
    UPDATE toko SET
      pajak_persen = ${persen},
      alamat = ${alamat?.trim() || null},
      telepon = ${telepon?.trim() || null},
      catatan_struk = ${catatan_struk?.trim() || null},
      ukuran_label = ${ukuran_label?.trim() || '50x30'},
      desain_nota = ${desain_nota?.trim() || 'klasik'}
    WHERE id = ${toko.tokoId}
  `
  return NextResponse.json({ pajak_persen: persen, alamat, telepon, catatan_struk, ukuran_label: ukuran_label?.trim() || '50x30', desain_nota: desain_nota?.trim() || 'klasik' })
}, { schema: pengaturanSchema })
