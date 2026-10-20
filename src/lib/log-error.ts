import sql, { pastikanErrorLog } from '@/lib/db'

// Fingerprint stabil: hash(code + route + status).
// Tujuan: GROUP BY fingerprint tahu top error tanpa text parse.
function fingerprint(code: string | null, route: string | null, status: number | null): string {
  const raw = `${code || ''}|${route || ''}|${status || ''}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Ekstrak route dari URL tanpa query string + tripping /api/ prefix.
function routeOf(url: string): string {
  try {
    const u = new URL(url, 'http://x')
    const p = u.pathname
    // normalisasi /api/bon/123 → /api/bon/[id]
    return p.replace(/\/\d+/g, '/[id]')
  } catch {
    return url
  }
}

// Ekstrak Postgres code (22021, 08P01, dsb) dari error message/stack.
function pgCodeOf(msg: string, e: unknown): string | null {
  const m = (e as { code?: string } | undefined)?.code
  if (m) return m
  const match = msg.match(/code: '(\w+)'/)
  return match ? match[1] : null
}

export interface LogErrorInput {
  method?: string
  url?: string
  status?: number
  message: string
  err?: unknown
  requestId?: string
  deviceId?: string
  param?: string  // contoh: 'unnamed portal parameter $3'
}

// LogError tulis ke error_log table + stream stdout JSON line.
// Fire-and-forget — error logging ga boleh throw error baru.
export async function LogError(input: LogErrorInput): Promise<void> {
  const method = input.method || 'GET'
  const route = routeOf(input.url || '')
  const status = input.status ?? 500
  const code = pgCodeOf(input.message, input.err)
  const fp = fingerprint(code, route, status)
  const message = input.message.slice(0, 2000)
  const stack = input.err instanceof Error ? (input.err.stack || '').slice(0, 4000) : null
  const line = JSON.stringify({
    type: 'error', ts: new Date().toISOString(), fingerprint: fp,
    code, route, method, status, message, param: input.param || null,
    requestId: input.requestId || null, deviceId: input.deviceId || null,
  })
  console.log(line)  // stdout JSON line — Coolify/docker logs capture

  try {
    await pastikanErrorLog()
    await sql`
      INSERT INTO error_log (fingerprint, code, route, method, status, message, param, request_id, device_id, stack)
      VALUES (${fp}, ${code}, ${route}, ${method}, ${status}, ${message}, ${input.param || null}, ${input.requestId || null}, ${input.deviceId || null}, ${stack})
    `
  } catch (e) {
    // Jangan biarkan logging error ganggu response. Tapi tetap stream ke stdout.
    console.error('[LOGERROR-FAIL]', e instanceof Error ? e.message : String(e))
  }
}