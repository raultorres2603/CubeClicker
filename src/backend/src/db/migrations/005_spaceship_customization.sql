-- CubeClicker spaceship customization schema (PostgreSQL 16) — migration 005.
-- Per-account lootboxes, keys, owned parts, and equipped appearance stored on
-- user_economy (mirrors the upgrades pattern). Idempotent: safe to re-run.

ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS lootboxes INT NOT NULL DEFAULT 0;
ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS keys INT NOT NULL DEFAULT 0;
ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS parts JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS appearance JSONB NOT NULL DEFAULT '{}'::jsonb;