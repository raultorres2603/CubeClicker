-- CubeClicker upgrades schema (PostgreSQL 16) — migration 003.
-- Per-account upgrade levels stored as JSONB on user_economy (Q-8 default).
-- Idempotent: safe to re-run.

ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS upgrades JSONB NOT NULL DEFAULT '{}'::jsonb;