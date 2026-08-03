import { randomBytes } from 'crypto'
import sql from './db'

// Device login (QR pairing) — logika DB terpusat dipakai endpoint auth.

export interface DeviceLoginRow {
  device_code: string
  status: 'pending' | 'done' | 'expired'
  email: string | null
  plan: string | null
  user_token: string | null
  expires_at: Date
  created_at: Date
  completed_at: Date | null
}

// device_code: 8 karakter base32 (huruf besar A-Z tanpa O/I + angka) — cukup
// kuat utk TTL 2 menit, mudah dibaca & diketik manual bila perlu.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

// Umur maksimum QR (detik). Sesuai polling desktop ~2 detik, user punya jeda
// nyaman utk scan di HP dan menyelesaikan SSO Z One.
export const DEVICE_TTL_SECONDS = 120

// Insert baris login pending. Kalau device_code bentrok (sangat kecil, 8 char
// dari 32 alfabet), ulangi hingga tak bentrok — sepele, tak kedawarsa cost.
export async function createDeviceLogin(): Promise<{ device_code: string; expires_at: Date }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const device_code = makeCode()
    const expires_at = new Date(Date.now() + DEVICE_TTL_SECONDS * 1000)
    try {
      await sql`
        INSERT INTO device_login (device_code, status, expires_at)
        VALUES (${device_code}, 'pending', ${expires_at})
      `
      return { device_code, expires_at }
    } catch (e) {
      // Pelanggaran unique (bentrok) — coba lagi; error lain biarkan naik.
      const msg = e instanceof Error ? e.message : String(e)
      if (!/duplicate key|unique/i.test(msg)) throw e
    }
  }
  throw new Error('Gagal membuat device_code — bentrok berulang.')
}

// Konfirmasi device saat SSO berhasil. Device hanya bisa "dipenuhi" sekali,
// masih pending & belum expired. Balikan true bila berhasil.
export async function confirmDeviceLogin(
  device_code: string,
  token: string,
  email: string,
  plan: string
): Promise<boolean> {
  const [row] = await sql<DeviceLoginRow[]>`
    SELECT * FROM device_login WHERE device_code = ${device_code}
  `
  if (!row) return false
  if (row.status !== 'pending') return false
  if (new Date(row.expires_at) < new Date()) return false
  if (row.user_token) return false // sudah pernah diisi — jangan ditimpa

  await sql`
    UPDATE device_login
    SET status = 'done', email = ${email}, plan = ${plan},
        user_token = ${token}, completed_at = now()
    WHERE device_code = ${device_code}
  `
  return true
}

// Poll: ambil status + (kalau done) token. Row yg expired ditandai on-the-fly.
export async function pollDeviceLogin(
  device_code: string
): Promise<{ status: 'pending' | 'done' | 'expired'; token?: string }> {
  const [row] = await sql<DeviceLoginRow[]>`
    SELECT * FROM device_login WHERE device_code = ${device_code}
  `
  if (!row) return { status: 'expired' }
  if (row.status === 'done' && row.user_token) {
    return { status: 'done', token: row.user_token }
  }
  if (row.status === 'expired' || new Date(row.expires_at) < new Date()) {
    // tandai expired sekali agar query berikutnya tidak scan ulang
    await sql`UPDATE device_login SET status = 'expired' WHERE device_code = ${device_code} AND status = 'pending'`
    return { status: 'expired' }
  }
  return { status: 'pending' }
}
