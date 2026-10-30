-- CubeClicker idle accrual schema (PostgreSQL 16) — migration 004.
-- Adds `last_seen_at` to user_economy for offline/idle coin accrual (idle-accrual).
-- Existing rows receive a single statement-level timestamp so no retroactive
-- accrual is granted on deploy (F10). Idempotent: safe to re-run.

ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
UPDATE user_economy SET last_seen_at = now() WHERE last_seen_at IS NULL;
ALTER TABLE user_economy ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE user_economy ALTER COLUMN last_seen_at SET DEFAULT now();