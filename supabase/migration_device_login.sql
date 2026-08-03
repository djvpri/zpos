-- Migration: Device login (QR pairing utk ZPos Windows desktop)
-- Jalankan via: psql $DATABASE_URL -f migration_device_login.sql
--
-- Alur: app desktop generate device_code (POST /api/auth/qr-request) → tampil QR.
-- Kasir scan di HP, Z One redirect ke /sso?token=...&device=... → sso-verify
-- sangkut user_token ke baris device_login ini → desktop poll /api/auth/qr-poll
-- dan dapat token ZPos utk sinkron (pull katalog + push antrian).

CREATE TABLE IF NOT EXISTS device_login (
  device_code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'expired')),
  email TEXT,
  plan TEXT,
  user_token TEXT,          -- zpos_token yg dihasilkan saat SSO berhasil
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_login_expires ON device_login(expires_at);
CREATE INDEX IF NOT EXISTS idx_device_login_status ON device_login(status);
