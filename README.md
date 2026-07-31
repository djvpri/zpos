# ZPos — POS Digital untuk UMKM Indonesia

Aplikasi kasir digital berbasis web, bagian dari ekosistem Z. Cepat, mobile-friendly, dan bisa offline.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend**: Postgres.js (SQL langsung via koneksi PostgreSQL)
- **Auth**: JWT (jose) + bcryptjs — httpOnly cookie, sameSite strict
- **Icons**: Bootstrap Icons (react-bootstrap-icons)
- **Charts**: Recharts
- **PWA**: @ducanh2912/next-pwa
- **Input Validation**: Zod
- **E2E Test**: Playwright
- **Storage**: PostgreSQL (Railway)

## Fitur

### 🏪 Kasir
- Grid produk, kalkulasi otomatis, diskon & pajak
- 3 metode bayar: **Tunai, QRIS, Transfer**
- Barcode scanner (USB + kamera via react-zxing)
- **Scan produk visual** (AI — integrasi Z-Face)
- Cetak struk otomatis
- Shift management (buka/tutup shift, set modal awal)
- **Mode offline** — transaksi tetap jalan walau tanpa sinyal, sinkron otomatis saat online

### 📦 Produk
- CRUD produk + kategori
- Import massal dari Excel (.xlsx)
- Scan barcode (USB + kamera)
- Stok otomatis berkurang saat transaksi
- **Limitasi** Trial: 100 produk, Pro: tak terbatas

### 📊 Laporan
- Penjualan harian (7 hari terakhir)
- Produk terlaris
- Riwayat transaksi
- Admin panel lintas-toko

### 👥 Staff
- Multi-role: **admin** (owner) & **kasir**
- Admin control dari Z One (SSO + QR login)
- Rate limiting login (brute-force protection)

## Setup

### 1. Clone & install
```bash
git clone https://github.com/djvpri/zpos.git
cd zpos
npm install
```

### 2. Database (PostgreSQL/Railway)
Koneksikan ke Postgres (Railway), lalu:
- Jalankan `supabase/schema.sql` (folder `supabase/` menyimpan file SQL; **nama folder legacy**, koneksi sebenarnya ke Postgres Railway, bukan Supabase)
- Jalankan migrasi `supabase/migration_*.sql` berurutan secara **manual**

### 3. Environment
Salin `.env.example` (atau buat `.env.local`):
```env
DATABASE_URL=postgresql://user:pass@host:5432/railway?sslmode=require
JWT_SECRET=your-random-secret-min-32-chars
RESEND_API_KEY=re_xxx          # untuk reset password
RESEND_FROM=ZPos <noreply@domain>
GEMINI_API_KEY=AIza...         # opsional: auto-detect nama produk dari foto (model 3.5 Flash-Lite)
ADMIN_EMAIL=admin@domain.com   # super admin
ADMIN_PASSWORD=your-password
```
Token JWT kedaluwarsa 30 hari. Reset token kedaluwarsa 1 jam.

### 4. Jalankan
```bash
npm run dev     # http://localhost:3000
```

Seed demo (isi data contoh ~2 bulan):
```bash
node scripts/seed-demo.js
```

### 5. Build production
```bash
npm run build   # next build --webpack
npm start
```

## Struktur Folder
```
src/
  app/
    app/            Halaman utama app (kasir, produk, laporan, dll)
    api/            REST API route handlers
    admin/          Panel super admin
    login/          Halaman login
    register/       Halaman registrasi
    forgot/         Lupa password
    reset/          Reset password
    sso/            SSO landing dari Z One
  components/
    kasir/          Komponen kasir (BarcodeScanner, KeranjangPanel, dll)
    produk/         Komponen produk (ProdukModal, ImportProduk, dll)
    laporan/        Komponen laporan
    staff/          Komponen staff
    pengaturan/     Pengaturan toko
    ui/             Komponen shared (Sidebar, Topbar, NotifikasiPanel)
  hooks/            Custom hooks (useAuth, useProduk, useTransaksi)
  lib/              Utility, auth, DB, validation, offline queue
  types/            TypeScript types
supabase/           Schema SQL + migrations
scripts/            Seed scripts
tests/              Playwright test files
```

## Keamanan
- **Input validation**: Zod di semua API route
- **Auth**: JWT httpOnly cookie, sameSite strict, rate limiting login
- **Admin panel**: Credentials dari env (terpisah dari user)
- **Role check**: Admin/kasir dibedakan di middleware & API
- **Offline mode**: Sesi tersimpan lokal (7 hari max), token asli tetap httpOnly
- **No CSRF**: sameSite strict melindungi cross-site form submission

## Ekosistem Z
ZPos terintegrasi dengan [Z One](https://github.com/djvpri/ZOne) — hub SSO untuk semua aplikasi Z:
- ZGold, ZLaundry, ZResto, Z-Rooms, Z-Absen, Z-Medics, ZBengkel, Z-Face, Z-Trans, dll.

