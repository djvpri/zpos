import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// GET: saldo + riwayat mutasi deposit tenant.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tokoId = parseInt(id)
  const [toko] = await sql`SELECT saldo, langganan_sampai FROM toko WHERE id = ${tokoId}`
  if (!toko) return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 })

  const riwayat = await sql`
    SELECT id, nominal, tipe, keterangan, created_at FROM toko_deposit
    WHERE toko_id = ${tokoId} ORDER BY created_at DESC LIMIT 100
  `
  return NextResponse.json({ saldo: Number(toko.saldo ?? 0), riwayat })
}

// POST: top-up (+positif) atau kurangi (−negatif) saldo tenant, catat toko_deposit.
// Body: { nominal: int } — nominal > 0 = top-up (debit dana tenant masuk),
//        nominal < 0 = penyesuaian/koreksi pengurangan.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tokoId = parseInt(id)
  const [toko] = await sql`SELECT saldo FROM toko WHERE id = ${tokoId}`
  if (!toko) return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 })

  const { nominal, keterangan } = await req.json()
  const nilai = Math.round(Number(nominal) || 0)
  if (!Number.isFinite(nilai) || nilai === 0) {
    return NextResponse.json({ error: 'Nominal wajib angka != 0' }, { status: 400 })
  }
  const ket = typeof keterangan === 'string' && keterangan.trim()
    ? keterangan.trim() : (nilai > 0 ? 'Top-up saldo' : 'Penyesuaian saldo')
  const tipe = nilai > 0 ? 'topup' : 'adjust'

  const [baru] = await sql.begin(async t => {
    const [upd] = await t`
      UPDATE toko SET saldo = saldo + ${nilai} WHERE id = ${tokoId} RETURNING saldo
    `
    await t`
      INSERT INTO toko_deposit (toko_id, nominal, tipe, keterangan)
      VALUES (${tokoId}, ${nilai}, ${tipe}, ${ket})
    `
    return [upd]
  })

  return NextResponse.json({ saldo: Number(baru.saldo) })
}
