import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'

// Kelola status & role user dalam satu toko (bukan create — akun dibuat via ZOne).
// Soft-delete (nonaktif) konsisten dengan /api/admin/cross-app action 'delete',
// supaya histori shift/transaksi user tetap aman & admin bisa aktifkan ulang.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const userId = parseInt(id)

  // Cek user milik toko ini & bukan admin itu sendiri (jangan nonaktifkan diri sendiri)
  const [diri] = await sql`SELECT id FROM "user" WHERE id = ${auth.userId}`

  const body = await req.json().catch(() => ({}))
  const { role, aktif, pin, password } = body

  if (role === undefined && aktif === undefined && pin === undefined && password === undefined) {
    return NextResponse.json({ error: 'role, aktif, pin, atau password wajib diisi' }, { status: 400 })
  }

  const [target] = await sql`SELECT id, role FROM "user" WHERE id = ${userId} AND toko_id = ${auth.tokoId}`
  if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  if (role !== undefined) {
    const valid = ['kasir', 'admin']
    if (!valid.includes(role)) return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    // Owner toko (admin pertama) jangan bisa diturunkan jadi kasir oleh admin lain —
    // cek kalau ini pemilik (user admin paling awal toko ini).
    if (role === 'kasir' && target.role === 'admin') {
      const [owner] = await sql`SELECT id FROM "user" WHERE toko_id = ${auth.tokoId} AND role = 'admin' ORDER BY created_at ASC LIMIT 1`
      if (owner && owner.id === userId) {
        return NextResponse.json({ error: 'Owner toko tidak bisa diturunkan jadi kasir' }, { status: 400 })
      }
    }
    // Jangan turunkan role admin diri sendiri
    if (diri && diri.id === userId && role !== 'admin') {
      return NextResponse.json({ error: 'Tidak bisa mengubah role akun sendiri' }, { status: 400 })
    }
    await sql`UPDATE "user" SET role = ${role} WHERE id = ${userId}`
  }

  if (aktif !== undefined) {
    if (diri && diri.id === userId && aktif === false) {
      return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 })
    }
    await sql`UPDATE "user" SET aktif = ${aktif ? true : false} WHERE id = ${userId}`
  }

  if (pin !== undefined) {
    if (target.role === 'admin') {
      return NextResponse.json({ error: 'Admin tidak wajib PIN kasir; hanya role kasir' }, { status: 400 })
    }
    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN harus 6 digit angka (0-9)' }, { status: 400 })
    }
    const pinHash = await bcrypt.hash(pin, 10)
    await sql`UPDATE "user" SET kasir_pin_hash = ${pinHash} WHERE id = ${userId}`
  }

  if (password !== undefined) {
    // Set/reset password utk login web & setup app kasir (banyak user login via
    // Google tanpa password lokal). Admin toko set password ini di zone manage.
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }
    const pw = await bcrypt.hash(password, 10)
    await sql`UPDATE "user" SET password_hash = ${pw} WHERE id = ${userId}`
  }

  const [updated] = await sql`SELECT id, nama, email, role, aktif FROM "user" WHERE id = ${userId}`

  // Audit: perubahan role/status staff — krusial utk cek kasir mengangkat dirinya sendiri.
  if (role !== undefined) {
    void catatAktivitas(auth, 'staff_ubah',
      `Role ${target.nama || `#${userId}`} ${target.role} → ${role}`)
  }
  if (aktif !== undefined) {
    const aksi: 'staff_tambah' | 'staff_hapus' = aktif ? 'staff_tambah' : 'staff_hapus'
    void catatAktivitas(auth, aksi,
      `${target.nama || `#${userId}`} di${aktif ? 'aktifkan' : 'nonaktifkan'}`)
  }
  if (pin !== undefined) {
    void catatAktivitas(auth, 'staff_pin',
      `${target.nama || `#${userId}`} PIN kasir diset`)
  }
  if (password !== undefined) {
    void catatAktivitas(auth, 'staff_password',
      `${target.nama || `#${userId}`} password diset/diubah utk login web & kasir`)
  }


  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const staffId = parseInt(id)

  if (auth.userId === staffId) {
    return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 })
  }

  const [staff] = await sql`
    SELECT id, nama FROM "user"
    WHERE id = ${staffId} AND toko_id = ${auth.tokoId}
  `
  if (!staff) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  // Soft-delete: nonaktif, bukan hapus baris (histori shift aman).
  await sql`UPDATE "user" SET aktif = false WHERE id = ${staffId}`

  void catatAktivitas(auth, 'staff_hapus', `Staff #${staffId} "${staff.nama}" dinonaktifkan`)
  return NextResponse.json({ ok: true })
}
