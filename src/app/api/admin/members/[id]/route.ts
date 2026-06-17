import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tokoId = parseInt(id)

  const [toko] = await sql`SELECT id, langganan_sampai FROM toko WHERE id = ${tokoId}`
  if (!toko) return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 })

  const { tambah_bulan, plan, aktif } = await req.json()

  if (tambah_bulan) {
    const bulan = [1, 3, 6, 12].includes(Number(tambah_bulan)) ? Number(tambah_bulan) : 1
    // Perpanjang dari tanggal akhir saat ini bila masih aktif, jika sudah lewat mulai dari sekarang.
    const sekarang = new Date()
    const akhir = toko.langganan_sampai && new Date(toko.langganan_sampai) > sekarang
      ? new Date(toko.langganan_sampai)
      : sekarang
    akhir.setMonth(akhir.getMonth() + bulan)
    await sql`UPDATE toko SET langganan_sampai = ${akhir} WHERE id = ${tokoId}`
  }

  if (plan === 'pro' || plan === 'trial') {
    await sql`UPDATE toko SET plan = ${plan} WHERE id = ${tokoId}`
  }

  if (typeof aktif === 'boolean') {
    await sql`UPDATE toko SET aktif = ${aktif} WHERE id = ${tokoId}`
  }

  const [updated] = await sql`
    SELECT t.id, t.nama, t.email, t.plan, t.aktif, t.created_at, t.langganan_sampai,
      (SELECT count(*) FROM "user" u WHERE u.toko_id = t.id) AS jumlah_user
    FROM toko t WHERE t.id = ${tokoId}
  `
  return NextResponse.json(updated)
}
