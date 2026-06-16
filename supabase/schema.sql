-- =============================================
-- ZPOS - Zomet POS Database Schema
-- Jalankan di Supabase SQL Editor
-- =============================================

-- Tabel Kategori
create table if not exists kategori (
  id serial primary key,
  nama text not null unique,
  created_at timestamptz default now()
);

insert into kategori (nama) values
  ('Makanan'), ('Minuman'), ('Snack'), ('Lainnya')
on conflict do nothing;

-- Tabel Produk
create table if not exists produk (
  id serial primary key,
  nama text not null,
  harga integer not null default 0,
  stok integer not null default 0,
  emoji text default '📦',
  kategori_id integer references kategori(id) on delete set null,
  aktif boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sample produk
insert into produk (nama, harga, stok, emoji, kategori_id) values
  ('Nasi Goreng',    25000, 50, '🍳', 1),
  ('Mie Ayam',       18000, 40, '🍜', 1),
  ('Ayam Goreng',    22000, 30, '🍗', 1),
  ('Bakso Spesial',  20000, 25, '🍲', 1),
  ('Es Teh Manis',    5000,100, '🧊', 2),
  ('Jus Jeruk',      12000, 30, '🍊', 2),
  ('Kopi Hitam',      8000, 60, '☕', 2),
  ('Es Campur',      15000, 20, '🥤', 2),
  ('Keripik Singkong', 8000,45, '🥔', 3),
  ('Cokelat Batang', 12000, 35, '🍫', 3),
  ('Permen',          3000, 80, '🍬', 3),
  ('Tisu Basah',      5000, 50, '🧻', 4);

-- Tabel Transaksi
create table if not exists transaksi (
  id serial primary key,
  no_transaksi text not null unique,
  subtotal integer not null default 0,
  diskon integer not null default 0,
  pajak integer not null default 0,
  total integer not null default 0,
  bayar integer not null default 0,
  kembali integer not null default 0,
  metode_bayar text not null default 'Tunai',
  kasir text default 'Kasir 1',
  created_at timestamptz default now()
);

-- Tabel Detail Transaksi
create table if not exists detail_transaksi (
  id serial primary key,
  transaksi_id integer references transaksi(id) on delete cascade,
  produk_id integer references produk(id) on delete set null,
  nama_produk text not null,
  harga integer not null,
  qty integer not null,
  subtotal integer not null,
  created_at timestamptz default now()
);

-- Update stok otomatis
create or replace function kurangi_stok()
returns trigger language plpgsql as $$
begin
  update produk set stok = stok - new.qty, updated_at = now()
  where id = new.produk_id;
  return new;
end;
$$;

create trigger trg_kurangi_stok
after insert on detail_transaksi
for each row execute function kurangi_stok();

-- Update timestamp produk
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_produk_updated_at
before update on produk
for each row execute function update_updated_at();

-- View laporan harian
create or replace view v_laporan_harian as
select
  date_trunc('day', created_at) as tanggal,
  count(*) as jumlah_transaksi,
  sum(total) as total_penjualan,
  round(avg(total)) as rata_rata,
  sum(diskon) as total_diskon
from transaksi
group by date_trunc('day', created_at)
order by tanggal desc;

-- View produk terlaris
create or replace view v_produk_terlaris as
select
  p.id, p.nama, p.emoji,
  coalesce(sum(dt.qty), 0) as total_qty,
  coalesce(sum(dt.subtotal), 0) as total_penjualan
from produk p
left join detail_transaksi dt on dt.produk_id = p.id
group by p.id, p.nama, p.emoji
order by total_qty desc;

-- RLS (Row Level Security)
alter table produk enable row level security;
alter table transaksi enable row level security;
alter table detail_transaksi enable row level security;
alter table kategori enable row level security;

-- Untuk development: izinkan semua (ganti dengan auth rules di production)
create policy "allow all produk" on produk for all using (true) with check (true);
create policy "allow all transaksi" on transaksi for all using (true) with check (true);
create policy "allow all detail" on detail_transaksi for all using (true) with check (true);
create policy "allow all kategori" on kategori for all using (true) with check (true);
