import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import sql from '@/lib/db'
import { signToken } from '@/lib/auth'

// Migration 2026-07-02: dual secret support  
const NEW_SECRET = new TextEncoder().encode(
  process.env.CROSS_APP_SECRET || 'uurclTHL375CiZeWi2g4T3GczU2YNY9I1wzjlsVTgSk'
)
const OLD_SECRET = new TextEncoder().encode('z-ecosystem-admin-2026')
const VALID_SECRETS = [NEW_SECRET, OLD_SECRET]
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// Terima SSO token dari Z One, cocokkan ke user ZPOS, buat sesi ZPOS
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token wajib diisi' }, { status: 400 })

    // 1. Verifikasi token dari Z One
    let payload: any
    let verified = false
    for (const secret of VALID_SECRETS) {
      try {
        const result = await jwtVerify(token, secret)
        payload = result.payload
        verified = true
        break
      } catch {
        continue
      }
    }
    if (!verified) {
      return NextResponse.json({ error: 'Token SSO tidak valid atau kedaluwarsa' }, { status: 401 })
    }

    if (payload.app !== 'zpos') {
      return NextResponse.json({ error: 'Token ini bukan untuk ZPOS' }, { status: 400 })
    }

    const email = String(payload.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email tidak ada di token' }, { status: 400 })

    // 2. Cari user di database ZPOS
    const [user] = await sql`
      SELECT u.id, u.nama, u.email, u.role, u.aktif,
             t.id as toko_id, t.nama as toko_nama, t.plan, t.aktif as toko_aktif
      FROM "user" u
      JOIN toko t ON t.id = u.toko_id
      WHERE lower(u.email) = ${email}
      LIMIT 1
    `

    if (!user) {
      return NextResponse.json({
        error: `Akun ${email} belum terdaftar di ZPOS. Hubungi admin ZPOS untuk menambahkan akun.`,
        code: 'USER_NOT_FOUND',
      }, { status: 404 })
    }

    if (!user.aktif) {
      return NextResponse.json({ error: 'Akun Anda dinonaktifkan. Hubungi admin.' }, { status: 403 })
    }

    if (!user.toko_aktif) {
      return NextResponse.json({ error: 'Toko Anda dinonaktifkan. Hubungi admin.' }, { status: 403 })
    }

    // 3. Buat sesi ZPOS (cookie zpos_token)
    const sessionToken = await signToken({
      userId: user.id,
      tokoId: user.toko_id,
      nama: user.toko_nama,
      userName: user.nama,
      email: user.email,
      plan: user.plan,
      role: user.role,
    })

    const res = NextResponse.json({ success: true, redirect: '/app' })
    res.cookies.set('zpos_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 hari
      path: '/',
    })
    return res
  } catch (err) {
    console.error('SSO verify error:', err)
    return NextResponse.json({ error: 'Gagal memproses SSO' }, { status: 500 })
  }
}
