import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getDemoResetSecret } from '@/lib/secrets'
import { seedDataDemo, bersihkanDataToko } from '@/lib/demo-seed'

export const runtime = 'nodejs'

// Endpoint ini dipanggil Railway Cron Job 1x/hari untuk mereset demo
// di SEMUA app ekosistem Zomet sekaligus:
//   1. Reset data demo ZPos sendiri
//   2. Panggil /api/demo/reset-daily di setiap app yang terdaftar di AppConfig
//
// Auth: Bearer DEMO_RESET_SECRET (sama dengan endpoint reset-daily ZPos)
// Tidak butuh login admin — aman karena secret hanya diketahui Railway Cron.

interface DemoApp {
  url: string
  secret: string
}

async function getRegisteredApps(): Promise<DemoApp[]> {
  try {
    const rows = await sql`SELECT value FROM "AppConfig" WHERE key = 'demo_reset_targets'`
    if (rows.length > 0) {
      const val = rows[0].value
      if (val.startsWith('[')) return JSON.parse(val)
      return val.split(',').filter(Boolean).map((pair: string) => {
        const [url, secret] = pair.split('|')
        return { url: url.trim(), secret: secret?.trim() || '' }
      })
    }
    return []
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')

  let cocok: boolean
  try {
    cocok = token === getDemoResetSecret()
  } catch {
    cocok = false
  }
  if (!cocok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasil: Array<{ app: string; status: 'success' | 'error'; message?: string }> = []

  // 1. Reset ZPos sendiri
  try {
    const tokoDemo = await sql`SELECT id, nama FROM toko WHERE is_demo = true`
    for (const t of tokoDemo) {
      await bersihkanDataToko(t.id)
      await seedDataDemo(t.id)
    }
    hasil.push({ app: 'zpos', status: 'success', message: `${tokoDemo.length} toko direset` })
  } catch (e: any) {
    hasil.push({ app: 'zpos', status: 'error', message: e?.message || 'error' })
  }

  // 2. Reset semua app terdaftar di demo-config
  const apps = await getRegisteredApps()
  for (const app of apps) {
    try {
      const url = `${app.url.replace(/\/$/, '')}/api/demo/reset-daily`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${app.secret}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      hasil.push({
        app: app.url,
        status: res.ok ? 'success' : 'error',
        message: res.ok ? 'OK' : `HTTP ${res.status}`,
      })
    } catch (e: any) {
      hasil.push({ app: app.url, status: 'error', message: e?.message || 'timeout' })
    }
  }

  const gagal = hasil.filter(h => h.status === 'error').length
  return NextResponse.json({
    ok: true,
    total: hasil.length,
    berhasil: hasil.length - gagal,
    gagal,
    hasil,
  })
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'zpos-demo-reset-all' })
}
