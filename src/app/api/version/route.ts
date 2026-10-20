import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { hostname } from 'os'
import path from 'path'
import sql from '@/lib/db'

// GET /api/version — verify deploy Coolify mendarat tanpa SSH.
// Returns: { buildId, serverStart, hostname, nodeVersion, lastDeploy, timestamp }
//
// buildId = Next.js generated per build (file .next/BUILD_ID)
// serverStart = process.uptime() → waktu container start
// lastDeploy = latest entry dari deploy_log (webhook Coolify)
//
// Agent workflow: hit /api/version setelah push+merge → bandingkan buildId
// dgn sebelumnya + cek lastDeploy timestamp. Berubah = deploy sukses.
export async function GET() {
  let buildId = 'unknown'
  try {
    buildId = await readFile(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').then(s => s.trim())
  } catch {
    // .next/BUILD_ID not present (e.g. dev mode)
  }

  let lastDeploy: string | null = null
  try {
    const rows = await sql`
      SELECT ts FROM deploy_log ORDER BY ts DESC LIMIT 1
    `
    if (rows.length > 0) lastDeploy = String(rows[0].ts)
  } catch {
    // deploy_log table belum ada — webhook belum pernah dipanggil
  }

  return NextResponse.json({
    buildId,
    serverStart: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptimeSec: Math.round(process.uptime()),
    hostname: hostname().slice(0, 20),
    nodeVersion: process.version,
    lastDeploy,
    timestamp: new Date().toISOString(),
  })
}