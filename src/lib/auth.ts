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
