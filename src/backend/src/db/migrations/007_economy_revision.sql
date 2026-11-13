-- CubeClicker economy revision (PostgreSQL 16) — migration 007.
-- Adds a monotonic per-account write revision to user_economy so the hub can order
-- async economy results: every credit/purchase bumps it inside the same atomic
-- statement, and a late older result can never regress the published totals.
-- Additive and idempotent: existing rows read 0, the pre-feature code ignores the
-- column, and no backfill is required (safe to leave in place on rollback).

ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS economy_revision BIGINT NOT NULL DEFAULT 0;
