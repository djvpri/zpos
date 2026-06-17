import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export interface TokenPayload {
  userId: number
  tokoId: number
  nama: string      // nama toko (untuk topbar)
  userName: string  // nama user yang login
  email: string
  plan: string
  role: 'owner' | 'kasir'
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
  return verifyToken(decodeURIComponent(match[1]))
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
