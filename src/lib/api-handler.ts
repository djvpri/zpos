import { NextResponse } from 'next/server'
import { ZodError, ZodSchema } from 'zod'
import { LogError } from '@/lib/log-error'

// Strip null bytes (\x00) dari string values — clipboard Windows / input
// kasir kadang bawa null byte yang ditolak Postgres dengan
// "invalid byte sequence for encoding UTF8: 0x00" (code 22021).
// Rekursif untuk nested object/array.
function sanitizeNullBytes(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\0/g, '')
  if (Array.isArray(value)) return value.map(sanitizeNullBytes)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k in value) out[k] = sanitizeNullBytes((value as Record<string, unknown>)[k])
    return out
  }
  return value
}

type Handler<T = unknown> = (
  req: Request,
  body: T,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<NextResponse>

interface ApiHandlerConfig {
  schema?: ZodSchema
  noBody?: boolean
}

export function apiHandler<T>(
  handler: Handler<T>,
  config?: ApiHandlerConfig
): (req: Request, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse> {
  const { schema, noBody } = config || {}

  return async (req: Request, context: { params: Promise<Record<string, string | string[]>> }) => {
    // x-srv-timing: lama PROSES di server (ms). Dibaca kasir (zpos-errors.log)
    // utk bedain "server lambat proses" vs "jaringan lambat" saat sync error.
    const start = Date.now()
    const withTiming = (res: NextResponse): NextResponse => {
      res.headers.set('x-srv-timing', String(Date.now() - start))
      return res
    }
    try {
      if (noBody) {
        return withTiming(await handler(req, null as unknown as T, context))
      }

      let body: unknown
      if (schema) {
        try {
          body = await req.json()
        } catch {
          return withTiming(NextResponse.json(
            { error: 'Format JSON tidak valid' },
            { status: 400 }
          ))
        }
        body = sanitizeNullBytes(body)
        body = schema.parse(body)
      } else {
        try {
          body = await req.json()
        } catch {
          body = {}
        }
        body = sanitizeNullBytes(body)
      }

      return withTiming(await handler(req, body as T, context))
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const messages = e.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`
        )
        return withTiming(NextResponse.json(
          { error: 'Validasi gagal', details: messages },
          { status: 400 }
        ))
      }

      const errMsg = e instanceof Error ? e.message : 'Unknown error'
      const pgCode = (e as { code?: string } | undefined)?.code || ''
      LogError({
        method: req.method,
        url: req.url,
        status: 500,
        message: errMsg,
        err: e,
        param: pgCode ? `pg:${pgCode}` : '',
      }).catch(() => {})

      return withTiming(NextResponse.json(
        { error: 'Terjadi kesalahan internal server' },
        { status: 500 }
      ))
    }
  }
}