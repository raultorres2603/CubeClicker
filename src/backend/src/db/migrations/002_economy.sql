-- CubeClicker economy schema (PostgreSQL 16) — migration 002.
-- Per-user persisted coins and in-game stats (clicks, faces destroyed, cubes
-- destroyed). 1:1 with users; cascade-deletes with the account.

CREATE TABLE IF NOT EXISTS user_economy (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins NUMERIC(18,2) NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  faces_destroyed BIGINT NOT NULL DEFAULT 0,
  cubes_destroyed BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);