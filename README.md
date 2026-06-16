# Zomet POS

Aplikasi kasir digital berbasis web — bagian dari ekosistem Zomet.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Icons**: Lucide React

## Setup

### 1. Install dependensi
```bash
npm install
```

### 2. Konfigurasi Supabase
- Buat project di https://supabase.com
- Copy Project URL dan Anon Key
- Isi file `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Buat database
- Buka Supabase > SQL Editor
- Jalankan file `supabase/schema.sql`

### 4. Jalankan aplikasi
```bash
npm run dev
```
Buka http://localhost:3000

## Fitur
- Kasir: tambah produk ke keranjang, diskon, 3 metode bayar (Tunai/QRIS/Transfer), struk otomatis
- Produk: tambah/edit/hapus produk, manajemen stok
- Laporan: ringkasan harian, produk terlaris, riwayat transaksi

## Struktur Folder
src/
  app/               Next.js App Router
  components/
    kasir/           Komponen halaman kasir
    produk/          Komponen manajemen produk
    laporan/         Komponen laporan
    ui/              Komponen shared (Sidebar, Topbar)
  hooks/             Custom hooks (useProduk, useTransaksi)
  lib/               Supabase client, utils
  types/             TypeScript types
supabase/
  schema.sql         Database schema lengkap
