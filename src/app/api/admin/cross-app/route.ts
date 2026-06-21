import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

// Endpoint ini dipanggil Z One (hub ekosistem) lewat /manage, bukan oleh
// browser pengguna langsung — autentikasi pakai Bearer secret, bukan cookie.

const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026'

function checkAuth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${CROSS_APP_SECRET}`
}

async function buildData() {
  const tokoRows = await sql`
    SELECT id, nama, plan, aktif, langganan_sampai FROM toko ORDER BY created_at DESC
  `
  const userRows = await sql`
    SELECT id, nama, email, toko_id, role, aktif FROM "user" ORDER BY created_at DESC
  `
  return {
    tenants: tokoRows.map((t) => ({
      id: String(t.id),
      name: t.nama,
      plan: t.plan || 'starter',
      active: t.aktif,
      expires_at: t.langganan_sampai,
    })),
    users: userRows.map((u) => ({
      id: String(u.id),
      name: u.nama,
      email: u.email,
      tenantId: String(u.toko_id),
      role: u.role,
      active: u.aktif,
    })),
  }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return Response.json(await buildData())
  } catch (err) {
    console.error('cross-app GET error:', err)
    return Response.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { action, email, data } = await req.json()

    if (action === 'createTenant') {
      const name = String(data?.name || '').trim()
      if (!name) return Response.json({ error: 'name wajib diisi' }, { status: 400 })
      const placeholderEmail = `tenant-${Date.now()}@zpos.placeholder`
      const placeholderHash = await bcrypt.hash(Math.random().toString(36), 10)
      const [toko] = await sql`
        INSERT INTO toko (nama, email, password_hash, plan)
        VALUES (${name}, ${placeholderEmail}, ${placeholderHash}, 'trial')
        RETURNING id, nama
      `
      return Response.json({ success: true, tenant: { id: String(toko.id), name: toko.nama } })
    }

    if (action === 'updatePlan') {
      const tenantId = Number(data?.tenantId)
      const plan = String(data?.plan || 'starter')
      if (!tenantId || Number.isNaN(tenantId)) return Response.json({ error: 'tenantId wajib diisi' }, { status: 400 })
      const expiresAt = data?.planExpires ? new Date(data.planExpires) : null
      if (expiresAt) {
        await sql`UPDATE toko SET plan = ${plan}, langganan_sampai = ${expiresAt} WHERE id = ${tenantId}`
      } else {
        await sql`UPDATE toko SET plan = ${plan} WHERE id = ${tenantId}`
      }
      return Response.json({ success: true })
    }

    if (action === 'deleteTenant') {
      const tenantId = Number(data?.tenantId)
      if (!tenantId || Number.isNaN(tenantId)) return Response.json({ error: 'tenantId wajib diisi' }, { status: 400 })
      await sql`DELETE FROM toko WHERE id = ${tenantId}`
      return Response.json({ success: true })
    }

    if (action === 'create') {
      const name = String(data?.name || '').trim()
      const userEmail = String(data?.email || '').trim()
      const password = String(data?.password || '')
      let tenantId = data?.tenantId ? Number(data.tenantId) : null
      if (!name || !userEmail || !password) {
        return Response.json({ error: 'name, email, password wajib diisi' }, { status: 400 })
      }
      const existing = await sql`SELECT id FROM "user" WHERE email = ${userEmail}`
      if (existing.length) return Response.json({ error: 'Email sudah digunakan' }, { status: 409 })

      if (!tenantId) {
        const [firstToko] = await sql`SELECT id FROM toko ORDER BY created_at ASC LIMIT 1`
        if (!firstToko) return Response.json({ error: 'Belum ada tenant, buat tenant dulu' }, { status: 400 })
        tenantId = firstToko.id
      }
      const passwordHash = await bcrypt.hash(password, 10)
      const [user] = await sql`
        INSERT INTO "user" (toko_id, nama, email, password_hash, role)
        VALUES (${tenantId}, ${name}, ${userEmail}, ${passwordHash}, 'kasir')
        RETURNING id, nama, email
      `
      return Response.json({ success: true, user: { id: String(user.id), name: user.nama, email: user.email } })
    }

    if (action === 'delete') {
      // Soft-delete: nonaktifkan akun, BUKAN hapus baris dari database.
      // User yang pernah buka shift kasir punya relasi FK ke tabel shift
      // (TANPA ON DELETE CASCADE, demi keutuhan riwayat transaksi/shift),
      // jadi hapus permanen akan selalu gagal untuk user yang pernah login kasir.
      // Nonaktifkan: user tidak bisa login lagi (lib/auth login cek aktif=true),
      // tapi histori transaksi & shift tetap aman.
      if (!email) return Response.json({ error: 'email wajib diisi' }, { status: 400 })
      const result = await sql`UPDATE "user" SET aktif = false WHERE email = ${email} RETURNING id`
      if (!result.length) return Response.json({ error: 'User tidak ditemukan' }, { status: 404 })
      return Response.json({ success: true, deactivated: true })
    }

    if (action === 'reactivate') {
      if (!email) return Response.json({ error: 'email wajib diisi' }, { status: 400 })
      const result = await sql`UPDATE "user" SET aktif = true WHERE email = ${email} RETURNING id`
      if (!result.length) return Response.json({ error: 'User tidak ditemukan' }, { status: 404 })
      return Response.json({ success: true, reactivated: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('cross-app POST error:', err)
    return Response.json({ error: 'Gagal memproses aksi' }, { status: 500 })
  }
}
