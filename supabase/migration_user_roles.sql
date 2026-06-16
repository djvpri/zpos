-- Migration: User roles (owner & kasir)
-- Jalankan via: psql $DATABASE_URL -f migration_user_roles.sql

CREATE TABLE IF NOT EXISTS "user" (
  id SERIAL PRIMARY KEY,
  toko_id INTEGER NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  nama VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner', 'kasir')),
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_toko_id ON "user"(toko_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);

-- Migrate existing toko owners ke tabel user
INSERT INTO "user" (toko_id, nama, email, password_hash, role)
SELECT id, nama, email, password_hash, 'owner'
FROM toko
WHERE email IS NOT NULL AND password_hash IS NOT NULL
ON CONFLICT (email) DO NOTHING;
