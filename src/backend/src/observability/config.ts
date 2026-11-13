/**
 * Observability configuration (T1).
 *
 * Pure environment parsing: the caller passes `process.env` (or a test object),
 * so this module has no side effects. Invalid values throw an `Error` naming the
 * variable, matching the existing auth/config style.
 *
 * Log-level resolution (AC-1):
 * - `NODE_ENV=production` -> `info`
 * - `NODE_ENV=development` -> `debug`
 * - `NODE_ENV=test` or unset `NODE_ENV` -> disabled (`false`)
 * - explicit `LOG_LEVEL` overrides all of the above
 */

/** Accepted values for `LOG_LEVEL`. */
export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

/** A validated `LOG_LEVEL` value. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/** The validated runtime observability configuration. */
export interface ObservabilityConfig {
  /** Resolved Pino level, or `false` when logging is disabled. */
  logLevel: LogLevel | false;
  /** Whether the internal `/metrics` route is enabled (default `true`). */
  metricsEnabled: boolean;
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

function resolveLogLevel(env: Record<string, string | undefined>): LogLevel | false {
  const raw = env.LOG_LEVEL;
  if (raw !== undefined) {
    if (!(LOG_LEVELS as readonly string[]).includes(raw)) {
      throw new Error(
        `LOG_LEVEL must be one of ${LOG_LEVELS.join('|')}; received "${raw}"`,
      );
    }
    return raw as LogLevel;
  }

  if (env.NODE_ENV === 'production') {
    return 'info';
  }
  if (env.NODE_ENV === 'development') {
    return 'debug';
  }
  return false;
}

/**
 * Parses and validates the observability configuration from an environment object.
 *
 * Throws (naming the variable) for an invalid `LOG_LEVEL` or `METRICS_ENABLED`,
 * so startup fails loudly instead of running with an unintended configuration.
 */
export function loadObservabilityConfig(
  env: Record<string, string | undefined>,
): ObservabilityConfig {
  return {
    logLevel: resolveLogLevel(env),
    metricsEnabled: readBoolean(env, 'METRICS_ENABLED', true),
  };
}
