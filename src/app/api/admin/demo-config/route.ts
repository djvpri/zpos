import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'

interface DemoApp {
  url: string
  secret: string
}

/**
 * Parse DEMO_RESET_TARGETS env var (JSON format)
 * Expected format: [{"url":"https://app1.com","secret":"secret1"}]
 */
function parseDemoTargets(): DemoApp[] {
  try {
    const raw = process.env.DEMO_RESET_TARGETS || '[]'
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * GET /api/admin/demo-config
 * Returns current DEMO_RESET_TARGETS configuration
 */
export async function GET(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targets = parseDemoTargets()
  return NextResponse.json({ targets })
}

/**
 * POST /api/admin/demo-config
 * Update DEMO_RESET_TARGETS configuration
 * Body: { targets: Array<{ url: string, secret: string }> }
 */
export async function POST(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { targets } = await req.json()

    if (!Array.isArray(targets)) {
      return NextResponse.json({ error: 'targets must be an array' }, { status: 400 })
    }

    // Validate each target
    for (const target of targets) {
      if (!target.url || !target.secret) {
        return NextResponse.json({ error: 'Each target must have url and secret' }, { status: 400 })
      }
      if (typeof target.url !== 'string' || typeof target.secret !== 'string') {
        return NextResponse.json({ error: 'url and secret must be strings' }, { status: 400 })
      }
    }

    // NOTE: In a real production environment, you would:
    // 1. Update this in a persistent config database
    // 2. Use a proper secrets management system (AWS Secrets Manager, HashiCorp Vault, etc.)
    // 3. Call Railway API to update environment variables if applicable
    //
    // For this demo, we're returning the configuration that would be saved.
    // The actual Railway integration would happen here.

    const configJson = JSON.stringify(targets)
    return NextResponse.json({
      success: true,
      message: 'Configuration updated (would be saved to DEMO_RESET_TARGETS env var)',
      targets,
      envVarValue: configJson,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * PUT /api/admin/demo-config
 * Test all demo reset endpoints
 */
export async function PUT(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targets = parseDemoTargets()
  const results: Array<{
    url: string
    status: 'success' | 'error'
    statusCode?: number
    message?: string
  }> = []

  for (const target of targets) {
    try {
      const resetUrl = `${target.url}/api/demo/reset-daily`
      const response = await fetch(resetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${target.secret}`,
          'Content-Type': 'application/json',
        },
      })

      results.push({
        url: target.url,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        message: response.ok ? 'Reset successful' : `HTTP ${response.status}`,
      })
    } catch (error) {
      results.push({
        url: target.url,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({ results })
}
