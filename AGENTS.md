# Z1Pos Server (djvpri/zpos) — Agent Guide

Next.js 14 + Postgres backend untuk Z1Pos ekosistem POS. Deploy via Coolify.

## Stack
- **Next.js 14** (App Router, server components, route handlers)
- **Postgres 18** (Coolify managed, `1fhosrzrapewqtv4wkqiw1rs`)
- **postgres.js v3.4.9** (avoid v4 — prepared statement cache bug pada `sql.unsafe()`)
- **zod** (validation), **jose** (JWT), **bcryptjs** (hash), **xlsx** (export), **sharp** (image)

## Build & Test
```bash
npm run build        # next build — semua route compiled
npm run lint         # eslint
npm test             # node --test (66 tests, 2s)
npm run test:headed  # playwright e2e
```

## Deploy
- **Coolify auto-deploy ON** — git push `main` → Coolify build → container restart
- Domain: `https://z1pos.zomet.my.id`
- Container ID pattern: `ocuwsrtcc0pqua8xcleyqxd4-<timestamp>`
- Health: `GET /api/health` → `{status:"ok",db:"connected",dbLatencyMs}`
- Build time: ~90 detik. Downtime: ±30 detik saat container swap.

## Struktur
```
src/
├── app/api/           Route handlers (REST-ish)
│   ├── admin/         Admin-only endpoints (diagnosa, devices, log-kasir)
│   ├── bon/           Bon grosir (KERANJANG_MAX=200 per item)
│   ├── transaksi/     Transaksi kasir
│   ├── pengaturan/    Pengaturan toko (auto-migrate desain_nota dll)
│   ├── item-virtual/  Item custom (Lainnya) — pastikanTabel()
│   ├── health/        Health check
│   ├── digiflazz/     Digiflazz webhook
│   └── ...
├── lib/
│   ├── db.ts          postgres client + pastikanErrorLog() auto-migrate
│   ├── api-handler.ts Wrapper route handler (sanitize null bytes + LogError)
│   ├── log-error.ts   LogError() — tulis ke error_log table + stdout JSON
│   ├── auth.ts        getTokoFromRequest, getAdminFromRequest
│   ├── validation.ts  Zod schemas
│   └── ...
└── app/
    ├── admin/         Admin dashboard (React)
    ├── toko/[subdomain]/  Halaman publik toko
    ├── app/           App share
    └── ...
scripts/
├── log-errors.sh      Wrapper SSH+psql utk cek error_log (AI-friendly)
└── migrate-*.mts      Migrasi data satu-shot
```

## Patterns

### Route handler pattern
```typescript
import { apiHandler } from '@/lib/api-handler'
export const PUT = apiHandler(async (req, body, context) => {
  // body sudah sanitize null bytes + zod-validated
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ... business logic
}, { schema: mySchema })
```

### Auto-migrate (idempotent)
Pattern: jalankan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` di awal handler.
WAJIB pakai `.simple()` — tanpa itu postgres.js prepare cache mismatch (08P01).
```typescript
await sql.unsafe("ALTER TABLE toko ADD COLUMN IF NOT EXISTS desain_nota text").simple()
```

### sql.unsafe() vs tagged template
- `sql\`SELECT ... WHERE id = ${x}\`` — tagged, prepared statement, parametrized (SAFE)
- `sql.unsafe('CREATE TABLE ...')` — untuk DDL tanpa param, WAJIB `.simple()` utk hindari cache bug

## Error Logging (AI-Agent Friendly)

### error_log table
Auto-migrate di `src/lib/db.ts` `pastikanErrorLog()`. Field:
- `fingerprint` — hash(code+route+status) utk GROUP BY pattern detection
- `code` — Postgres code (22021, 08P01, 23505) atau null
- `route` — normalisasi `/api/bon/[id]` (bukan `/api/bon/123`)
- `method`, `status`, `message`, `param`, `request_id`, `device_id`, `stack`

### LogError()
```typescript
import { LogError } from '@/lib/log-error'
await LogError({
  method: 'POST', url: req.url, status: 500,
  message: '...',
  err: e,                    // extract code + stack
  param: 'pg:22021',         // optional hint
  deviceId: 'PC-KASIR-1',    // optional
})
```

### Cek error via API (admin)
```
GET /api/admin/diagnosa?toko_id=N
→ { ..., error_summary: [{ fingerprint, code, route, hits, last_ts, sample_message, sample_param }] }
```

### Cek error via script
```bash
./scripts/log-errors.sh                    # 24 jam, JSON
./scripts/log-errors.sh --since 6h --pattern UTF8
./scripts/log-errors.sh --device PC-KASIR-1 --table
```

## Pitfalls (wajib tahu)

### 1. KERANJANG_MAX = 200
Bon grosir maks 200 item. Hardcoded di `src/app/api/bon/route.ts` + `src/app/api/bon/[id]/route.ts`.
Naikkan jika perlu, tapi uji performa — Postgres JSONB dengan 200 keys masih cepat, 1000+ mulai lambat.

### 2. Null bytes dari clipboard Windows
Kasir desktop (Tauri) kadang kirim field berisi `\x00` (clipboard Windows).
Postgres reject dengan `invalid byte sequence UTF8: 0x00` (22021).
Fix: `sanitizeNullBytes()` di `apiHandler` strip `\0` dari string values sebelum `schema.parse`.

### 3. Prepared statement cache mismatch
`sql.unsafe()` tanpa `.simple()` bisa cache collision antar request → `bind message supplies 0 parameters` (08P01).
Solusi: semua `sql.unsafe()` untuk DDL pakai `.simple()`.

### 4. NOTICE bukan error
`column "X" already exists, skipping` adalah NOTICE normal dari `ADD COLUMN IF NOT EXISTS`.
Bukan error. Jangan treat sebagai bug.

### 5. Sync kasir desktop (Tauri)
Kasir desktop `zpos_windows` sync via `/api/bon`, `/api/transaksi`.
Pola error sync → cek `log_kasir` table (`konten` text field, regex `GAGAL|error`).
Skilled detail: skill `zpos-server-nextjs` references/cek-log-kasir.md.

## Konvensi
- **Bahasa**: code comments & user-facing error dalam Bahasa Indonesia
- **Commit message**: `<type>(<scope>): <desc>` — `fix(log):`, `feat(api):`, `refactor:`
- **Branch**: `feat/...`, `fix/...`, `chore/...` — squash-merge ke main
- **No tests for trivial changes** — tapi reproduksi bug wajib (lihat `tests/repro/`)
- **Idempotent migrations** — semua `ALTER TABLE` pakai `IF NOT EXISTS`

## Quick Commands
```bash
# Cek health
curl https://z1pos.zomet.my.id/api/health

# Cek deploy mendarat (via SSH)
ssh djvpri@103.93.129.94 "sudo docker ps --format '{{.Names}}\t{{.CreatedAt}}' | grep ocuwsrtcc"

# Cek error log 24 jam
./scripts/log-errors.sh

# SSH ke container postgres
ssh djvpri@103.93.129.94 "sudo docker exec -it 1fhosrzrapewqtv4wkqiw1rs psql -U postgres -d postgres"

# Cek log_kasir table
ssh djvpri@103.93.129.94 "sudo docker exec 1fhosrzrapewqtv4wkqiw1rs psql -U postgres -d postgres -c \"SELECT id, nama_pc, LEFT(konten,300) FROM log_kasir ORDER BY id DESC LIMIT 10\""
```

## Env (Coolify)
- `DATABASE_URL` — postgres connection string (internal Docker network)
- `DATABASE_SSL` — `true` untuk Railway, false untuk Coolify VPS internal
- `JWT_SECRET` — signing key
- `DIGIFLASS_*` — Digiflazz credentials (utk produk digital)

## Sister Repos
- `djvpri/zpos_windows` — Tauri desktop kasir (offline-first, sync ke server ini)
- `djvpri/zpos_admin` — Admin panel (Next.js, terpisah dari server ini)
