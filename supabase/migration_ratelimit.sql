-- Migration: Rate limiting percobaan login (anti brute-force)
-- Jalankan via: psql $DATABASE_URL -f migration_ratelimit.sql

CREATE TABLE IF NOT EXISTS login_attempt (
  id serial PRIMARY KEY,
  kunci text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_kunci ON login_attempt(kunci, created_at);
