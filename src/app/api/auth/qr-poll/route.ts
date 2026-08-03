import { NextResponse } from 'next/server'
import { pollDeviceLogin } from '@/lib/device-login'
import { apiHandler } from '@/lib/api-handler'
import { qrDeviceSchema } from '@/lib/validation'

// Dekstop polling utk tahu kapan QR discan + SSO selesai. GET, device_code via
// query. Bila status 'done', sertakan user_token ZPos hasil SSO utk dipakai
// sinkron (pull katalog + push antrian).
export const GET = apiHandler(
  async (req: Request) => {
    const { searchParams } = new URL(req.url)
    const device_code = searchParams.get('code') ?? ''
    if (!device_code || device_code.length < 8) {
      return NextResponse.json({ error: 'device_code tidak valid' }, { status: 400 })
    }
    void qrDeviceSchema.parse({ device_code })
    const result = await pollDeviceLogin(device_code)
    return NextResponse.json(result)
  },
  { noBody: true }
)
