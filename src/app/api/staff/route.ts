import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Pembuatan user TIDAK lagi dilakukan di ZPos — akun kasir/admin dibuat
// lewat ZOne /manage (control panel ekosistem), yang meneruskan ke
// /api/admin/cross-app (action 'create'). Halaman Staff ZPos hanya
// KELOLA (lihat, ubah role, aktif/nonaktif) dari akun yang sudah ada.

export async function GET(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const staff = await sql`
    SELECT id, nama, email, role, aktif, created_at
    FROM "user"
    WHERE toko_id = ${auth.tokoId}
    ORDER BY role = 'admin' DESC, created_at ASC
  `
  return NextResponse.json(staff)
}
