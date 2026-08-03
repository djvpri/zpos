import { NextResponse } from 'next/server'
import { createDeviceLogin, DEVICE_TTL_SECONDS } from '@/lib/device-login'
import { apiHandler } from '@/lib/api-handler'

// Endpoint publik (tanpa auth): meminta device_code baru utk QR login desktop.
// Balikan kode + durasi TTL (detik), biar desktop tahu kapan QR harus diganti.
export const POST = apiHandler(async () => {
  const { device_code, expires_at } = await createDeviceLogin()
  return NextResponse.json({
    device_code,
    expires_at: expires_at.toISOString(),
    ttl_seconds: DEVICE_TTL_SECONDS,
    url: `/sso?device=${device_code}`,
  })
}, { noBody: true })
