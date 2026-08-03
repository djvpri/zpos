import { NextResponse } from 'next/server'
import { confirmDeviceLogin } from '@/lib/device-login'
import { apiHandler } from '@/lib/api-handler'
import { qrConfirmSchema } from '@/lib/validation'

// Sangkut token ZPos ke baris device_login setelah SSO berhasil. Dipanggil
// halaman /sso-device setalah browser HP selesai login Z One + verify token.
// Bisa juga dipakai endpoint lain di ekosistem bila perlu pairing manual.
export const POST = apiHandler(async (_req: Request, body: { device_code: string; token: string }) => {
  const ok = await confirmDeviceLogin(body.device_code, body.token, '', '')
  if (!ok) {
    return NextResponse.json({ error: 'Kode QR tidak valid, sudah dipakai, atau kedaluwarsa.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}, { schema: qrConfirmSchema })
