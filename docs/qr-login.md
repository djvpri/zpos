# Login QR untuk Desktop ZPOS (Jalur C)

Kasir duduk di kasir, buka app desktop ZPOS, pilih **Sinkron ke Server ZPos →
Scan QR dengan HP**. Muncul QR. Kasir scan pakai HP, mau login Z One (sekali),
app desktop langsung terhubung (token terpasang otomatis) — **tanpa ketik
kredensial/ambil cookie manual di mesin kasir**.

## Alur lengkap

```
Desktop ZPOS ──POST──▶ {ZPOS}/api/auth/qr-request        (buat device_login pending)
       │                balik: url = {ZONE}/sso/zpos?device=X
       ▼
render QR berisi url di atas
       │
kasir scan pakai HP ──▶ buka Z One /sso/zpos?device=X
       │                (kalau belum login Z One → halaman login → login sekali)
       ▼
Z One /sso/zpos: buat JWT cross-app, redirect ──▶ {ZPOS}/sso?token=...&device=X
       ▼
ZPOS /sso + /api/auth/sso-verify:
   • verify JWT (CROSS_APP_SECRET, app==='zpos')
   • cari user ZPOS (by email), buat cookie zpos_token (30 hari)
   • device hadir → confirmDeviceLogin(X, token, email, plan) → status 'done'
       ▼
Desktop poll {ZPOS}/api/auth/qr-poll (tiap 2 detik) ──▶ status 'done' + token
       ▼
simpan token → sync_remote (terhubung, data sinkron)
```

## Prasyarat / langkah setup

### 1. DB ZPOS — jalankan migrasi
Tabel `device_login` belum ada di produksi. Pakai salah satu:

```bash
# Railway (atau host yang sama dgn DB ZPOS):
cat supabase/migration_device_login.sql | psql "$DATABASE_URL"
```

`DATABASE_URL` diambil dari env produksi ZPOS di Railway. Isi SQL: table
`device_login` (device_code PK, status pending/done/expired, email, plan,
user_token, expires_at, created_at, completed_at) + index `expires_at`.

### 2. Env ZPOS — set `ZONE_BASE_URL`
Di Railway ZPOS, tambah env:

```
ZONE_BASE_URL=https://zone.zomet.my.id
```

Tanpa variabel ini, `qr-request` melempar error (fail fast). `CROSS_APP_SECRET`
harus SAMA dengan Z One (untuk verify token SSO — sudah dibutuhkan sebelumnya).

### 3. Z One — deploy perubahan
Z One repo branch `feat/zpos-qr-login`:
- `src/app/api/sso/[slug]/route.ts` — kini baca `?device=` query dan teruskan ke
  redirect ZPos. Tanpa `device`, perilaku lama tidak berubah.

Pastikan di tabel `app` Z One (Prisma) ada slug `zpos` dengan `url` mengarah ke
base ZPOS (`https://zpos.zomet.my.id`). Arahkan ke `https://zone.zomet.my.id/sso/zpos`.
Endpon `/sso/zpos` redirect `/login` bila kasir belum login Z One — normal.

### 4. Desktop ZPOS — build Rust
Rust toolchain **tidak ada** di mesin pengembangan ini; build exe wajib di mesin
yang ada `cargo`. Setelah deploy 1–3, di folder desktop:

```bash
cd src-tauri
cargo check        # verifikasi kompilasi
cargo build --release
```

## Catatan setup/opsi

- **TTL QR**: 2 menit (`DEVICE_TTL_SECONDS`). Desktop otomatis buat QR baru
  bila kedaluwarsa.
- **Token desktop**: `zpos_token` (JWT 30 hari), disimpan `localStorage`.
- **Security**: `device_code` 8 char random base32; `device_login` hanya bisa
  diisi sekali (status `pending` → `done`); poll tak membocorkan token sebelum
  `done`; QR tak membawa `zpos_token` ke browser HP.
- **CORS**: semua panggilan server (qr-request/qr-poll/sync) lewat Rust
  `reqwest`, bukan fetch webview → tak kena CORS.

## Verifikasi manual

1. Buka desktop ZPOS → Sinkron → **Scan QR dengan HP**.
2. Scan pakai HP (harus terisolasi dari mesin kasir — pakai data seluler).
3. Di HP: login Z One bila diminta, lalu otomatis redirect kembali.
4. Desktop: indikator berubah "Terhubung" + data tersinkron tanpa ketik token.
