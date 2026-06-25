import { SignJWT, jwtVerify } from 'jose'
import sql from './db'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export interface TokenPayload {
  userId: number
  tokoId: number
  nama: string
  userName: string
  email: string
  plan: string
  role: 'owner' | 'kasir'
  _roleUpdated?: boolean
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

export async function getTokoFromRequest(request: Request): Promise<TokenPayload | null> {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/zpos_token=([^;]+)/)
  if (!match) return null
  const payload = await verifyToken(decodeURIComponent(match[1]))
  if (!payload) return null

  // Cek role terbaru dari DB (hindari stale role setelah diubah dari Z One)
  try {
    const rows = await sql`SELECT role, aktif FROM "user" WHERE id = ${payload.userId} LIMIT 1`
    if (!rows.length || !rows[0].aktif) return null
    if (rows[0].role !== payload.role) {
      payload.role = rows[0].role as 'owner' | 'kasir'
      payload._roleUpdated = true
    }
  } catch {
    // Fallback ke token jika DB tidak bisa diakses
  }

  return payload
}

// ===== Super-admin (kredensial via env, terpisah dari sesi toko/user) =====

export interface AdminPayload {
  admin: true
  email: string
}

export async function signAdminToken(email: string): Promise<string> {
  return new SignJWT({ admin: true, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function getAdminFromRequest(request: Request): Promise<AdminPayload | null> {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/zpos_admin=([^;]+)/)
  if (!match) return null
  try {
    const { payload } = await jwtVerify(decodeURIComponent(match[1]), secret)
    if (payload.admin === true) return payload as unknown as AdminPayload
    return null
  } catch {
    return null
  }
}

// ===== Token reset password (token bertanda tangan, kedaluwarsa 1 jam) =====

export interface ResetPayload {
  purpose: 'reset'
  userId: number
  email: string
}

export async function signResetToken(userId: number, email: string): Promise<string> {
  return new SignJWT({ purpose: 'reset', userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret)
}

export async function verifyResetToken(token: string): Promise<ResetPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.purpose === 'reset') return payload as unknown as ResetPayload
    return null
  } catch {
    return null
  }
}
