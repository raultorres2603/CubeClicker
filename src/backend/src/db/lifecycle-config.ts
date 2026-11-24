/**
 * Database lifecycle configuration (T3).
 *
 * Pure environment parsing for the two in-process database lifecycle services:
 * the startup schema bootstrap and the expired-verification cleanup scheduler.
 * The only input is the environment object handed in by the caller
 * (`process.env` at the composition root), so this module has no side effects
 * and is fully unit-testable.
 *
 * Settings live here — separate from `AuthConfig` (`auth/config.ts`) — so the
 * auth layer never sees lifecycle settings (D10). Invalid values (including
 * empty strings) throw an `Error` naming the exact variable, matching the
 * existing auth and observability config style, so startup fails loudly
 * instead of running with an unintended configuration.
 */

/** Default expired-verification cleanup cadence: one hour. */
export const DEFAULT_CLEANUP_INTERVAL_MS = 3_600_000;
/** Minimum accepted cleanup cadence: 60 seconds. */
export const MIN_CLEANUP_INTERVAL_MS = 60_000;
/** Maximum accepted cleanup cadence: 24 hours. */
export const MAX_CLEANUP_INTERVAL_MS = 86_400_000;

/** The validated database lifecycle configuration handed to the DB services. */
export interface DbLifecycleConfig {
  /** Whether the startup schema bootstrap runs after migrations (default `true`). */
  bootstrapEnabled: boolean;
  /** Whether the in-process expired-verification cleanup scheduler starts (default `true`). */
  cleanupEnabled: boolean;
  /** Delay between cleanup runs, in milliseconds (default one hour). */
  cleanupIntervalMs: number;
}

function readBoolean(
  env: Record<string, string | undefined>,
  name: string,
  fallback: boolean,
): boolean {
  const raw = env[name];
  if (raw === undefined) {
    return fallback;
  }
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  throw new Error(
    `${name} must be a boolean ("true", "false", "1", or "0"); received "${raw}"`,
  );
}

function readInteger(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined) {
    return fallback;
  }
  const invalid = new Error(
    `${name} must be an integer between ${min} and ${max}; received "${raw}"`,
  );
  if (!/^-?\d+$/.test(raw)) {
    throw invalid;
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw invalid;
  }
  return value;
}

/**
 * Parses and validates the database lifecycle configuration from an environment
 * object.
 *
 * Throws (naming the variable) for an invalid boolean or cleanup interval, so
 * startup fails loudly instead of running with an unintended configuration.
 */
export function loadDbLifecycleConfig(
  env: Record<string, string | undefined>,
): DbLifecycleConfig {
  return {
    bootstrapEnabled: readBoolean(env, 'DB_SCHEMA_BOOTSTRAP_ENABLED', true),
    cleanupEnabled: readBoolean(env, 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED', true),
    cleanupIntervalMs: readInteger(
      env,
      'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS',
      DEFAULT_CLEANUP_INTERVAL_MS,
      MIN_CLEANUP_INTERVAL_MS,
      MAX_CLEANUP_INTERVAL_MS,
    ),
  };
}
