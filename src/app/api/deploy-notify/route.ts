import { NextResponse } from 'next/server'
import sql from '@/lib/db'

// POST /api/deploy-notify — webhook utk Coolify post-deploy.
// Coolify bisa konfigur webhook ke endpoint ini setelah deploy sukses.
// Server simpan lastDeploy → /api/version return. Verifikasi tanpa SSH.
//
// Setup di Coolify: Project → Settings → Webhooks → Add:
//   URL: https://z1pos.zomet.my.id/api/deploy-notify
//   Events: deployment.success
//   Headers: X-Deploy-Secret: <set DEPLOY_SECRET di .env>
//
// Agent: hit /api/version setelah merge → bandingkan serverStart timestamp
// dgn lastDeploy di DB. Match = webhook Coolify sampai.
export async function POST(req: Request) {
  // Auth: shared secret di header
  const secret = process.env.DEPLOY_SECRET
  if (secret) {
    const got = req.headers.get('x-deploy-secret')
    if (got !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Pastikan tabel deploy_log ada
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS deploy_log (
      id serial PRIMARY KEY,
      event text,
      deploy_id text,
      status text,
      ts timestamptz NOT NULL DEFAULT now()
    )
  `).simple()

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // body tidak wajib JSON
  }

  await sql`
    INSERT INTO deploy_log (event, deploy_id, status)
    VALUES (
      ${String(body.event || 'deployment.success')},
      ${String(body.deployment_id || body.id || 'unknown')},
      ${String(body.status || 'success')}
    )
  `

  return NextResponse.json({
    ok: true,
    received: new Date().toISOString(),
    deployId: body.deployment_id || body.id || 'unknown',
  })
}