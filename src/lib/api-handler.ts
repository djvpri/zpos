import { NextResponse } from 'next/server'
import { ZodError, ZodSchema } from 'zod'

/* eslint-disable @typescript-eslint/no-unused-vars */

type Handler<T = unknown> = (
  req: Request,
  body: T,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

interface ApiHandlerConfig {
  schema?: ZodSchema
  noBody?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiHandler<T>(
  handler: Handler<T>,
  config?: ApiHandlerConfig
): (req: Request, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
  const { schema, noBody } = config || {}

  return async (req: Request, context?: { params: Promise<Record<string, string>> }) => {
    try {
      if (noBody) {
        return await handler(req, null as unknown as T, context)
      }

      let body: unknown
      if (schema) {
        try {
          body = await req.json()
        } catch {
          return NextResponse.json(
            { error: 'Format JSON tidak valid' },
            { status: 400 }
          )
        }
        body = schema.parse(body)
      } else {
        try {
          body = await req.json()
        } catch {
          body = {}
        }
      }

      return await handler(req, body as T, context)
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const messages = e.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`
        )
        return NextResponse.json(
          { error: 'Validasi gagal', details: messages },
          { status: 400 }
        )
      }

      const errMsg = e instanceof Error ? e.message : 'Unknown error'
      console.error('[API ERROR]', req.method, req.url, errMsg)

      return NextResponse.json(
        { error: 'Terjadi kesalahan internal server' },
        { status: 500 }
      )
    }
  }
}
