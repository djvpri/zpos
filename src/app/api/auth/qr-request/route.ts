import { NextResponse } from 'next/server'
import { createDeviceLogin, DEVICE_TTL_SECONDS } from '@/lib/device-login'
import { getZoneBaseUrl } from '@/lib/secrets'
import { apiHandler } from '@/lib/api-handler'

// Endpoint publik (tanpa auth): meminta device_code baru utk QR login desktop.
// Alur (Jalur C): kasir scan QR → buka Z One /api/sso/zpos?device=... → login
// Z One (atau sudah login) → Z One redirect balik ke ZPos /sso?token=...&device=...
// → ZPos pasang token ke device_login → desktop poll /qr-poll dapat token.
// Di sini URL QR dibangun dari base Z One (bukan base ZPos), karena pairing
// lewat sesi akun Z One kasir. Prefix WAJIB /api — route Z One =
// /api/sso/[slug].
export const POST = apiHandler(async () => {
  const { device_code, expires_at } = await createDeviceLogin()
  const zoneBase = getZoneBaseUrl()
  return NextResponse.json({
    device_code,
    expires_at: expires_at.toISOString(),
    ttl_seconds: DEVICE_TTL_SECONDS,
    url: `${zoneBase}/api/sso/zpos?device=${device_code}`,
  })
}, { noBody: true })
