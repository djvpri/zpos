import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import sql from '@/lib/db'

interface DemoApp {
  url: string
  secret: string
}

const CONFIG_KEY = 'demo_reset_targets'

async function getConfig(): Promise<DemoApp[]> {
  try {
    const rows = await sql`SELECT value FROM "AppConfig" WHERE key = ${CONFIG_KEY}`
    if (rows.length > 0) {
      const val = rows[0].value
      if (val.startsWith('[')) {
        return JSON.parse(val)
      }
      return val.split(',').filter(Boolean).map((pair: string) => {
        const [url, secret] = pair.split('|')
        return { url: url.trim(), secret: secret?.trim() || '' }
      })
    }
    const envRaw = process.env.DEMO_RESET_TARGETS || ''
    if (!envRaw) return []
    if (envRaw.startsWith('[')) return JSON.parse(envRaw)
    return envRaw.split(',').filter(Boolean).map((pair: string) => {
      const [url, secret] = pair.split('|')
      return { url: url.trim(), secret: secret?.trim() || '' }
    })
  } catch { return [] }
}

async function saveConfig(targets: DemoApp[]) {
  await sql`
    INSERT INTO "AppConfig" (key, value, updated_at)
    VALUES (${CONFIG_KEY}, ${JSON.stringify(targets)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `.catch(async () => {
    await sql`CREATE TABLE IF NOT EXISTS "AppConfig" (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '[]', updated_at TIMESTAMP DEFAULT NOW())`
    await sql`INSERT INTO "AppConfig" (key, value, updated_at) VALUES (${CONFIG_KEY}, ${JSON.stringify(targets)}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
  })
}

function formatPipe(targets: DemoApp[]): string {
  return targets.map(t => `${t.url}|${t.secret}`).join(',')
}

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const targets = await getConfig()
  return NextResponse.json({ targets, envVarValue: formatPipe(targets) })
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { targets } = await req.json()
    if (!Array.isArray(targets)) return NextResponse.json({ error: 'targets must be an array' }, { status: 400 })
    for (const t of targets) {
      if (!t.url || !t.secret) return NextResponse.json({ error: 'Each target must have url and secret' }, { status: 400 })
    }
    await saveConfig(targets)
    return NextResponse.json({ success: true, message: 'Configuration saved', targets, envVarValue: formatPipe(targets) })
  } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
}

export async function PUT(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const targets = await getConfig()
  const results: Array<{ url: string; status: 'success' | 'error'; statusCode?: number; message?: string }> = []
  for (const t of targets) {
    try {
      const url = `${t.url.replace(/\/$/, '')}/api/demo/reset-daily`
      const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${t.secret}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) })
      results.push({ url: t.url, status: r.ok ? 'success' : 'error', statusCode: r.status, message: r.ok ? 'OK' : `HTTP ${r.status}` })
    } catch (e: unknown) {
      results.push({ url: t.url, status: 'error', message: (e as Error)?.message || 'error' })
    }
  }
  return NextResponse.json({ results })
}
