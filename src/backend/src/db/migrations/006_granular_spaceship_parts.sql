-- CubeClicker granular spaceship parts schema (PostgreSQL 16) — migration 006.
-- Adds a persisted customization version and rewrites the legacy category-based
-- parts/appearance JSONB to the v2 granular slot model: body -> hull, wings -> both
-- wings, engine -> both ignitions, nose/cockpit retained. Part counts are bounded to
-- int4 (0..2147483647); non-numeric/overflow entries are dropped and duplicate keys
-- are summed. Idempotent: safe to re-run.

ALTER TABLE user_economy
  ADD COLUMN IF NOT EXISTS customization_version INT NOT NULL DEFAULT 1;

-- Appearance: rewrite legacy category keys and their legacy part-id values to v2.
UPDATE user_economy
SET appearance = jsonb_strip_nulls(
  jsonb_build_object(
    'hull',
      CASE
        WHEN COALESCE(appearance->>'hull', appearance->>'body') LIKE 'body-%'
          THEN replace(COALESCE(appearance->>'hull', appearance->>'body'), 'body-', 'hull-')
        ELSE COALESCE(appearance->>'hull', appearance->>'body')
      END,
    'nose', appearance->>'nose',
    'cockpit', appearance->>'cockpit',
    'wing-left',
      CASE
        WHEN COALESCE(appearance->>'wing-left', appearance->>'wings') LIKE 'wings-%'
          THEN replace(COALESCE(appearance->>'wing-left', appearance->>'wings'), 'wings-', 'wing-left-')
        ELSE COALESCE(appearance->>'wing-left', appearance->>'wings')
      END,
    'wing-right',
      CASE
        WHEN COALESCE(appearance->>'wing-right', appearance->>'wings') LIKE 'wings-%'
          THEN replace(COALESCE(appearance->>'wing-right', appearance->>'wings'), 'wings-', 'wing-right-')
        ELSE COALESCE(appearance->>'wing-right', appearance->>'wings')
      END,
    'engine-left', appearance->>'engine-left',
    'engine-right', appearance->>'engine-right',
    'ignition-left',
      CASE
        WHEN COALESCE(appearance->>'ignition-left', appearance->>'engine') LIKE 'engine-%'
          THEN replace(COALESCE(appearance->>'ignition-left', appearance->>'engine'), 'engine-', 'ignition-left-')
        ELSE COALESCE(appearance->>'ignition-left', appearance->>'engine')
      END,
    'ignition-right',
      CASE
        WHEN COALESCE(appearance->>'ignition-right', appearance->>'engine') LIKE 'engine-%'
          THEN replace(COALESCE(appearance->>'ignition-right', appearance->>'engine'), 'engine-', 'ignition-right-')
        ELSE COALESCE(appearance->>'ignition-right', appearance->>'engine')
      END,
    'tail-fin', appearance->>'tail-fin'
  )
);

-- Parts: expand legacy keys to one/two v2 keys, drop non-numeric/overflow counts,
-- and sum collisions in the expanded key space.
UPDATE user_economy AS e
SET parts = (
  WITH raw AS (
    SELECT
      p.key,
      CASE WHEN p.value ~ '^[0-9]+$' THEN p.value::numeric END AS amount
    FROM jsonb_each_text(e.parts) AS p(key, value)
  ),
  bounded AS (
    SELECT key, amount
    FROM raw
    WHERE amount BETWEEN 0 AND 2147483647
  ),
  expanded AS (
    SELECT
      CASE
        WHEN key IN ('body-default', 'body-obsidian', 'body-gold')
          THEN ARRAY[replace(key, 'body-', 'hull-')]
        WHEN key IN ('wings-default', 'wings-silver')
          THEN ARRAY[
            replace(key, 'wings-', 'wing-left-'),
            replace(key, 'wings-', 'wing-right-')
          ]
        WHEN key IN ('engine-default', 'engine-blue')
          THEN ARRAY[
            replace(key, 'engine-', 'ignition-left-'),
            replace(key, 'engine-', 'ignition-right-')
          ]
        ELSE ARRAY[key]
      END AS target_keys,
      amount
    FROM bounded
  ),
  pairs AS (
    SELECT unnest(target_keys) AS key, amount
    FROM expanded
  ),
  summed AS (
    SELECT key, SUM(amount) AS amount
    FROM pairs
    GROUP BY key
  )
  SELECT COALESCE(jsonb_object_agg(key, amount), '{}'::jsonb)
  FROM summed
);

UPDATE user_economy
SET customization_version = 2
WHERE customization_version < 2;

ALTER TABLE user_economy
  ALTER COLUMN customization_version SET DEFAULT 2;
