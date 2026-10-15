# Z1 Pos — Development Guide for AI Agents

> Sumber kebenaran untuk agent yang bekerja di codebase ini. Baca sebelum edit.

## Apa Ini

Z1 Pos = POS (point-of-sale) multi-tenant untuk toko grosir/ritel. Tiap toko = tenant terisolasi via `toko_id`. Backend Next.js 16 (App Router) + PostgreSQL. Frontend kasir = Tauri desktop app (Windows) yang embed HTML+JS (`zpos_windows/src/index.html`) dan sync ke server ini.

Stack: Next.js 16, React 19, PostgreSQL 18, `postgres` (not Prisma), Zod 4, Tailwind 4, Jose JWT.

## Deploy & Akses Cepat

```
Repo:     github.com/djvpri/zpos  (public)
VPS:      103.93.129.94  (SSH user: djvpri)
Coolify:  http://103.93.129.94:8000
App UUID: ocuwsrtcc0pqua8xcleyqxd4
Domain:   z1pos.zomet.my.id (via Coolify FQDN)
DB UUID:  1fhosrzrapewqtv4wkqiw1rs (PostgreSQL 18, Coolify managed)
```

### Env vars (container)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | `postgresql://postgres:***@postgresql-database-1fhosrzrapewqtv4wkqiw1rs:5432/postgres` |
| `JWT_SECRET` | HMAC key untuk sign token (jose HS256) |
| `ADMIN_EMAIL` | Super-admin email (login `/api/admin/login`) |
| `ADMIN_PASSWORD` | Super-admin password |
| `ZONE_BASE_URL` | ZOne SSO hub URL |
| `DIGIFLAZZ_USERNAME` | Digiflazz API user (penjualan digital) |

### Verifikasi cepat dari terminal

```bash
# Health check
curl -s https://z1pos.zomet.my.id/api/health

# SSH ke VPS + query DB
ssh djvpri@103.93.129.94 "sudo docker exec 1fhosrzrapewqtv4wkqiw1rs psql -U postgres -d postgres -c 'SELECT id,nama,plan,aktif FROM toko ORDER BY id'"

# Lihat container logs
ssh djvpri@103.93.129.94 "sudo docker logs \$(sudo docker ps -q -f name=ocuwsrtcc0pqua8xcleyqxd4) --since 24h 2>&1 | grep -i error | tail -20"

# Admin login → dapat cookie zpos_admin
curl -s -X POST https://z1pos.zomet.my.id/api/admin/login -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}' -c /tmp/cookies.txt

# Diagnosa toko (admin auth)
curl -s 'https://z1pos.zomet.my.id/api/admin/diagnosa?toko_id=8' -H 'Cookie: zpos_admin=<token>'
```

## Arsitektur

```
zpos/
├── src/app/api/         # API routes (App Router)
│   ├── health/          # GET — liveness + DB ping
│   ├── auth/            # login, register, QR, SSO, me, users, forgot/reset
│   ├── admin/           # super-admin endpoints (log-kasir, members, digiflazz, diagnosa)
│   ├── bon/             # bon gantung: POST (create), PATCH (edit/settle), DELETE
│   ├── transaksi/       # transaksi kasir (POST = checkout)
│   ├── produk/          # CRUD produk, barcode, import, duplikat
│   ├── laporan/         # laporan penjualan
│   ├── kasir/           # log sync kasir desktop
│   ├── shift/           # shift kasir (buka/tutup)
│   ├── ai/              # analisis bisnis via Gemini
│   └── ...
├── src/lib/             # business logic
│   ├── db.ts            # postgres client (DATABASE_URL, ssl conditional)
│   ├── auth.ts          # JWT sign/verify, getTokoFromRequest, admin auth
│   ├── api-handler.ts   # wrapper: JSON parse, Zod validate, x-srv-timing, error catch
│   ├── bon-sesi.ts      # sesi bon gantung (grup per-kiriman)
│   ├── ratelimit.ts     # login attempt limiter (5/15min)
│   ├── aktivitas.ts     # audit log (fire-and-forget)
│   ├── validation.ts    # Zod schemas (login, register, produk, dst.)
│   └── ...
├── src/middleware.ts    # auth gate: /app (zpos_token), /admin (zpos_admin)
├── src/app/app/         # dashboard toko (admin & kasir UI)
├── src/app/admin/       # dashboard super-admin
├── migrations/          # SQL migration files (manual, not auto-run)
├── tests/               # node:test + playwright
└── zpos_windows/        # Tauri desktop app (kasir offline)
    └── src/index.html   # monolith HTML+JS kasir (~2900 lines)
```

## Auth Model

**2 lapis token (sama secret, beda cookie):**

| Token | Cookie | Scope | Login via |
|-------|--------|-------|-----------|
| `zpos_token` | `zpos_token` | per-toko (`tokoId`) | `POST /api/auth/login` `{email, password}` |
| `zpos_admin` | `zpos_admin` | super-admin (all toko) | `POST /api/admin/login` `{email, password}` (env creds) |

Token expiry: 30 hari (toko), 7 hari (admin). Algorithm: HS256 (jose).

`getTokoFromRequest(req)` — extract + verify token, **re-check role dari DB** (cegah stale role).

Middleware whitelist:
- `/api/health` — public
- `/api/auth/*` — public (login/register/QR/SSO)
- `/api/admin/login` — public
- `/api/admin/diagnosa` — admin token required
- `/login`, `/register`, `/sso` — public pages
- `/app/*` — requires `zpos_token`
- `/admin/*` — requires `zpos_admin`

## DB Schema (27 tables)

Multi-tenant: hampir semua tabel punya `toko_id` FK ke `toko`. **Isolasi via app-level filter** (middleware + `getTokoFromRequest`), bukan DB RLS.

### Tabel utama

| Tabel | Purpose | Key columns |
|-------|---------|-------------|
| `toko` | tenant master | `id, nama, plan, aktif, subdomain, desain_nota, kurangi_stok, jual_stok_habis, langganan_sampai` |
| `user` | pegawai toko | `id, toko_id, nama, email, password_hash, role, aktif` |
| `produk` | katalog barang | `id, toko_id, nama, harga, stok, barcode, kategori_id, foto` |
| `transaksi` | transaksi kasir | `id, toko_id, user_id, total, bon_tebus_id, shift_id, created_at` |
| `detail_transaksi` | item per transaksi | `id, transaksi_id, produk_id, qty, harga, subtotal` |
| `bon` | bon gantung (hold) | `id, toko_id, nama, produk_json, sesi_json, harga_json, vmap_json, total, selesai, dibayar_at, created_at` |
| `log_kasir` | sync log dari desktop | `id, toko_id, device_id, nama_pc, konten, created_at` |
| `log_aktivitas` | audit trail | `id, toko_id, user_id, aksi, deskripsi, created_at` |
| `member` | pelanggan | `id, toko_id, nama, telepon, kategori_member_id` |
| `kategori` | kategori produk | `id, toko_id, nama` |
| `shift` | shift kasir | `id, toko_id, user_id, dibuka, ditutup, modal_awal` |
| `item_virtual` | item custom (id negatif) | `id, toko_id, nama, harga` |
| `stock_opname` | so header | `id, toko_id, status, created_at` |
| `harga_member` | harga khusus member | `id, toko_id, produk_id, kategori_member_id, harga` |

### Bon gantung storage

`produk_json` = `Record<produk_id, qty>` flat snapshot final.
`sesi_json` = array snapshot per-grup: `[{t: ISO, p: {id:qty}, h?: {id:harga}}]`.
`harga_json` = harga terkunci per produk saat digantung.
`vmap_json` = nama/harga item virtual (id negatif).

## API Patterns

### apiHandler wrapper (`src/lib/api-handler.ts`)

Semua API route pakai `apiHandler`:
- Parse JSON body otomatis
- Optional Zod schema validation
- `x-srv-timing` header (ms) di semua response
- Catch ZodError → 400 `{error: "Validasi gagal", details: [...]}`
- Catch unknown → 500 `{error: "Terjadi kesalahan internal server"}` + `console.error('[API ERROR]', ...)`

### Error response format

```json
{ "error": "Pesan error user-facing" }
```

Status codes:
- 400 — validasi gagal / input invalid
- 401 — unauthorized (token hilang/expired)
- 403 — forbidden (role salah)
- 404 — resource tidak ditemukan
- 429 — rate limited (login attempt)
- 500 — server error

## Bug Patterns & Pitfalls

### 1. Bon gantung "mengedit, menyinkronkan" stuck

**Gejala:** Kasir desktop tampil label biru "mengedit, menyinkronkan" di bon list.
**Penyebab:** `retryEditBon()` di `zpos_windows/src/index.html` mengirim PATCH `/api/bon/[id]` tapi server reject (400).
**Cek:**
```sql
SELECT konten FROM log_kasir WHERE toko_id = 8 AND konten LIKE '%edit bon%GAGAL%' ORDER BY created_at DESC LIMIT 5;
```
**Fix umum:**
- Limit item: `KERANJANG_MAX` di `src/app/api/bon/route.ts:49` (POST) + `src/app/api/bon/[id]/route.ts:50` (PATCH)
- Produk tidak milik toko: cek `produk.toko_id` vs `toko_id` di token
- Bon sudah selesai: PATCH reject jika `selesai=true`

### 2. Sync kasir desktop gagal

**Gejala:** `log_kasir.konten` berisi "sync GAGAL".
**Cek:**
```bash
ssh djvpri@103.93.129.94 "sudo docker exec 1fhosrzrapewqtv4wkqiw1rs psql -U postgres -d postgres -c \"SELECT id, device_id, LEFT(konten, 200) FROM log_kasir WHERE toko_id = 8 ORDER BY created_at DESC LIMIT 5\""
```
**Penyebab umum:** DB unreachable, token expired, network timeout, item count > limit.

### 3. PostgreSQL encoding error (code 22021)

**Gejala:** `severity: 'ERROR', code: '22021', routine: 'report_invalid_encoding_int'`.
**Penyebab:** String encoding mismatch — biasanya dari `produk.nama` yang mengandung karakter non-UTF8 dari import Excel.
**Fix:** Sanitize input sebelum insert, atau set client encoding `SET client_encoding = 'UTF8'`.

### 4. Item virtual (id negatif)

Item virtual = item custom tanpa row produk (mis. "Lainnya"). ID = hash negatif dari nama+harga. Namanya disimpan di `vmap_json` di bon. **Tidak boleh** di-filter sebagai "id tidak valid" — valid selama ada di `vmap`.

### 5. Multi-tenant isolation

**WAJIB** filter `WHERE toko_id = ${toko.tokoId}` di setiap query. Tidak ada DB-level RLS. Token decode → `tokoId` di payload → semua query harus pakai.

## Testing

```bash
npm test          # node:test — tests/*.test.mjs
npm run build     # next build (semua route harus compile)
npm run lint      # eslint
```

Bon tests: `tests/bon-*.test.mjs` — 32+ tests covering sesi, edit, cetak, preset virtual.

## Kasir Desktop (zpos_windows)

Terpisah dari repo zpos. Monolith `src/index.html` (~2900 lines) + Tauri Rust backend.
- Sync interval: 45 detik (jika ada bon) atau `PULL_MS` (jika kosong)
- `retryEditBon()` — retry sync edit bon yang gagal (flag `editPending=true`)
- `replayBonServer()` — kirim bon lokal yang belum punya server ID
- Log error: `logErr('BON', ...)` → POST ke `/api/kasir/log`

## Tauri commands

Kasir desktop panggil server via `tinv('edit_bon', {baseUrl, bonId, produk, ...})` → Rust HTTP client.
Token JWT dipegang Rust (meta `token_jwt`), bukan di localStorage JS.
