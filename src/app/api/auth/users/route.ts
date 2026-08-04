import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'

// Tarik daftar semua user dalam 1 toko BESERTA kasir_pin_hash, utk disinkron ke
// kasir desktop. HANYA admin (role 'admin') — kasir biasa JANGAN bisa eksfiltrasi
// pin_hash (bcrypt tapi tetap tak boleh). Dipanggil sekali saat setup kasir.
export async function GET(req: Request) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await sql`
    SELECT id, toko_id, nama, email, role, aktif, COALESCE(kasir_pin_hash, '') AS kasir_pin_hash
    FROM "user"
    WHERE toko_id = ${auth.tokoId}
    ORDER BY nama ASC
  `

  return NextResponse.json({ toko_id: auth.tokoId, users })
}
