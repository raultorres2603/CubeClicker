/**
 * Required database schema contract (T2, AC-2).
 *
 * This module pins the complete DDL for the five tables the backend needs to
 * serve traffic (`users`, `sessions`, `verification_tokens`, `user_economy`,
 * `schema_migrations`) in dependency order. The DDL is copied verbatim from the
 * normative block in
 * `docs/features/db-schema-bootstrap-and-expiry-cleanup/spec.md` § Required
 * schema contract, which mirrors the consolidated `src/backend/src/db/schema.sql`
 * after migration 007.
 *
 * It is compile-time TypeScript on purpose: no runtime `.sql` file is loaded, so
 * the runtime image needs no extra copy and a table created by the bootstrap is
 * immediately usable with the pinned types, NOT NULL constraints, defaults,
 * primary/foreign/unique constraints and the two `users` functional unique
 * indexes.
 *
 * Every statement is idempotent (`IF NOT EXISTS`) and is executed in order
 * inside one transaction per table by `runSchemaBootstrap`. The `columns` array
 * follows the normative DDL column order; it drives the missing-column report
 * (so `missingColumns` is comma-joined in DDL order, not alphabetical).
 */

/** One required table and its idempotent creation statements. */
export interface RequiredTable {
  readonly name: string;
  /** Normative DDL order; `missingColumns` preserves this order. */
  readonly columns: readonly string[];
  /** Idempotent statements executed in order inside one transaction. */
  readonly statements: readonly string[];
}

/**
 * The five required tables in creation order (`users` first because `sessions`,
 * `verification_tokens` and `user_economy` reference it).
 */
export const REQUIRED_TABLES: readonly RequiredTable[] = [
  {
    name: 'users',
    columns: [
      'id',
      'username',
      'email',
      'password_hash',
      'verified',
      'failed_login_attempts',
      'locked_until',
      'created_at',
      'updated_at',
    ],
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      'CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (lower(username));',
      'CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email));',
    ],
  },
  {
    name: 'sessions',
    columns: [
      'id',
      'user_id',
      'token_hash',
      'expires_at',
      'created_at',
      'last_seen_at',
    ],
    statements: [
      `CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    ],
  },
  {
    name: 'verification_tokens',
    columns: ['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at'],
    statements: [
      `CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    ],
  },
  {
    name: 'user_economy',
    columns: [
      'user_id',
      'coins',
      'clicks',
      'faces_destroyed',
      'cubes_destroyed',
      'economy_revision',
      'upgrades',
      'lootboxes',
      'keys',
      'parts',
      'appearance',
      'customization_version',
      'last_seen_at',
      'updated_at',
    ],
    statements: [
      `CREATE TABLE IF NOT EXISTS user_economy (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins NUMERIC(18,2) NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  faces_destroyed BIGINT NOT NULL DEFAULT 0,
  cubes_destroyed BIGINT NOT NULL DEFAULT 0,
  economy_revision BIGINT NOT NULL DEFAULT 0,
  upgrades JSONB NOT NULL DEFAULT '{}'::jsonb,
  lootboxes INT NOT NULL DEFAULT 0,
  keys INT NOT NULL DEFAULT 0,
  parts JSONB NOT NULL DEFAULT '{}'::jsonb,
  appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  customization_version INT NOT NULL DEFAULT 2,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    ],
  },
  {
    name: 'schema_migrations',
    columns: ['name', 'applied_at'],
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    ],
  },
];
