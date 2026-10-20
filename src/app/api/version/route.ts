import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { hostname } from 'os'
import path from 'path'

// GET /api/version — verify deploy Coolify mendarat tanpa SSH.
// Returns: { buildId, serverStart, hostname, nodeVersion }
//
// buildId = Next.js generated per build (file .next/BUILD_ID)
// serverStart = process.uptime() → waktu container start
// hostname = container hostname
//
// Agent workflow: hit /api/version setelah push+merge → bandingkan buildId
// dgn sebelumnya. Berubah = deploy sukses.
export async function GET() {
  let buildId = 'unknown'
  try {
    buildId = await readFile(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').then(s => s.trim())
  } catch {
    // .next/BUILD_ID not present (e.g. dev mode)
  }

  return NextResponse.json({
    buildId,
    serverStart: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptimeSec: Math.round(process.uptime()),
    hostname: hostname().slice(0, 20),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  })
}