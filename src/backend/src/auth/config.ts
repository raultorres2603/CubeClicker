/**
 * Backend authentication configuration (T1).
 *
 * Pure environment parsing: the only input is the environment object handed in by
 * the caller (`process.env` at the composition root), so this module has no side
 * effects and is fully unit-testable. Auth settings live here — separate from
 * `GameConfig` (`game/config.ts`) — so the hub never sees DB/SMTP/session
 * settings (F9).
 *
 * Secrets (DATABASE_URL, SMTP_PASS, …) are read from the environment at runtime
 * and are never committed or baked into images (AC-29).
 */

/** Default SMTP host for the dev Mailpit container (plan § Containerization). */
export const DEFAULT_SMTP_HOST = 'mailpit';
/** Default SMTP port for Mailpit. */
export const DEFAULT_SMTP_PORT = 1025;
/** Default sender address used when SMTP_FROM is unset. */
export const DEFAULT_SMTP_FROM = 'no-reply@cubeclicker.local';

/** Default bound on SMTP connection, greeting and socket timeouts (10 seconds). */
export const DEFAULT_SMTP_CONNECTION_TIMEOUT_MS = 10_000;
export const MIN_SMTP_CONNECTION_TIMEOUT_MS = 1_000;
export const MAX_SMTP_CONNECTION_TIMEOUT_MS = 120_000;

/** Default verification-link base URL (frontend dev server). */
export const DEFAULT_APP_BASE_URL = 'http://localhost:5173';
/** Default allowed Origin for CSRF checks (frontend dev server). */
export const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:5173';

/** Session-cookie SameSite values accepted from `SESSION_COOKIE_SAMESITE`. */
export type SessionCookieSameSite = 'lax' | 'strict' | 'none';

/** Default SameSite posture: first-party cookies, local and same-site custom domains. */
export const DEFAULT_SESSION_COOKIE_SAMESITE: SessionCookieSameSite = 'lax';

/** Default session lifetime in days (AC-16: 7-day sliding expiry). */
export const DEFAULT_SESSION_TTL_DAYS = 7;
export const MIN_SESSION_TTL_DAYS = 1;
export const MAX_SESSION_TTL_DAYS = 365;

/** OWASP-minimum Argon2id parameters (AC-11): memory >= 19 MiB, t >= 2, p >= 1. */
export const DEFAULT_ARGON2_MEMORY_COST = 19456; // KiB (19 MiB)
export const MIN_ARGON2_MEMORY_COST = 19456;
export const MAX_ARGON2_MEMORY_COST = 1048576; // 1 GiB
export const DEFAULT_ARGON2_TIME_COST = 2;
export const MIN_ARGON2_TIME_COST = 2;
export const MAX_ARGON2_TIME_COST = 10;
export const DEFAULT_ARGON2_PARALLELISM = 1;
export const MIN_ARGON2_PARALLELISM = 1;
export const MAX_ARGON2_PARALLELISM = 16;

/** Default verification-token lifetime (24 hours). */
export const DEFAULT_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const MIN_VERIFICATION_TOKEN_TTL_MS = 60 * 1000;
export const MAX_VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The validated runtime authentication configuration handed to the auth layer. */
export interface AuthConfig {
  /** Postgres connection string, or null when no database is configured (in-memory repos). */
  databaseUrl: string | null;
  /** SMTP host used by the email service. */
  smtpHost: string;
  /** SMTP port used by the email service. */
  smtpPort: number;
  /** Whether the SMTP connection uses implicit TLS (`SMTP_SECURE`, default: port 465). */
  smtpSecure: boolean;
  /** SMTP username, or null when SMTP auth is disabled. */
  smtpUser: string | null;
  /** SMTP password, or null when SMTP auth is disabled. */
  smtpPass: string | null;
  /** Sender address for outbound email. */
  smtpFrom: string;
  /** Bound applied to the SMTP connection, greeting and socket timeouts, in milliseconds. */
  smtpConnectionTimeoutMs: number;
  /** Absolute base URL used to build verification links. */
  appBaseUrl: string;
  /** Origin allowed for state-changing auth requests (CSRF, AC-15). */
  allowedOrigin: string;
  /** Whether the session cookie is marked Secure. */
  sessionCookieSecure: boolean;
  /** SameSite attribute for the session cookie (`none` requires Secure). */
  sessionCookieSameSite: SessionCookieSameSite;
  /** Session lifetime in days. */
  sessionTtlDays: number;
  /** Session lifetime in milliseconds (derived from `sessionTtlDays`). */
  sessionTtlMs: number;
  /** Argon2id memory cost in KiB. */
  argon2MemoryCost: number;
  /** Argon2id time cost (iterations). */
  argon2TimeCost: number;
  /** Argon2id parallelism. */
  argon2Parallelism: number;
  /** Verification-token lifetime in milliseconds. */
  verificationTokenTtlMs: number;
}

function readOptionalString(
  env: Record<string, string | undefined>,
  name: string,
): string | null {
  const raw = env[name];
  if (raw === undefined) {
    return null;
  }
  if (raw === '') {
    return null;
  }
  return raw;
}

function readRequiredString(
  env: Record<string, string | undefined>,
  name: string,
  fallback: string,
): string {
  const raw = env[name];
  if (raw === undefined) {
    return fallback;
  }
  if (raw === '') {
    throw new Error(`${name} must be a non-empty string; received ""`);
  }
  return raw;
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

function parseBoolean(raw: string, name: string): boolean {
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

function readBoolean(
  env: Record<string, string | undefined>,
  name: string,
  fallback: boolean,
): boolean {
  const raw = env[name];
  if (raw === undefined) {
    return fallback;
  }
  return parseBoolean(raw, name);
}

/** Reads a boolean where an absent or empty variable means "not configured". */
function readOptionalBoolean(
  env: Record<string, string | undefined>,
  name: string,
): boolean | null {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return null;
  }
  return parseBoolean(raw, name);
}

function readSessionCookieSameSite(
  env: Record<string, string | undefined>,
): SessionCookieSameSite {
  const raw = env.SESSION_COOKIE_SAMESITE;
  if (raw === undefined) {
    return DEFAULT_SESSION_COOKIE_SAMESITE;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'lax' || value === 'strict' || value === 'none') {
    return value;
  }
  throw new Error(
    `SESSION_COOKIE_SAMESITE must be one of "lax", "strict", or "none"; received "${raw}"`,
  );
}

function readDatabaseUrl(
  env: Record<string, string | undefined>,
): string | null {
  const raw = env.DATABASE_URL;
  if (raw === undefined) {
    return null;
  }
  if (raw === '') {
    return null;
  }
  return raw;
}

/**
 * Parses and validates the authentication configuration from an environment object.
 *
 * Throws (naming the variable) for an invalid value, so startup fails loudly
 * instead of running with an unintended configuration.
 */
export function loadAuthConfig(
  env: Record<string, string | undefined>,
): AuthConfig {
  const databaseUrl = readDatabaseUrl(env);
  const smtpHost = readRequiredString(env, 'SMTP_HOST', DEFAULT_SMTP_HOST);
  const smtpPort = readInteger(env, 'SMTP_PORT', DEFAULT_SMTP_PORT, 1, 65535);
  const smtpSecure =
    readOptionalBoolean(env, 'SMTP_SECURE') ?? (smtpPort === 465);
  const smtpUser = readOptionalString(env, 'SMTP_USER');
  const smtpPass = readOptionalString(env, 'SMTP_PASS');
  if ((smtpUser === null) !== (smtpPass === null)) {
    throw new Error(
      'SMTP_USER and SMTP_PASS must be provided together (both or neither)',
    );
  }
  const smtpFrom = readRequiredString(env, 'SMTP_FROM', DEFAULT_SMTP_FROM);
  const smtpConnectionTimeoutMs = readInteger(
    env,
    'SMTP_CONNECTION_TIMEOUT_MS',
    DEFAULT_SMTP_CONNECTION_TIMEOUT_MS,
    MIN_SMTP_CONNECTION_TIMEOUT_MS,
    MAX_SMTP_CONNECTION_TIMEOUT_MS,
  );
  const appBaseUrl = readRequiredString(env, 'APP_BASE_URL', DEFAULT_APP_BASE_URL);
  const allowedOrigin = readRequiredString(
    env,
    'ALLOWED_ORIGIN',
    DEFAULT_ALLOWED_ORIGIN,
  );
  const sessionCookieSecure = readBoolean(env, 'SESSION_COOKIE_SECURE', false);
  const sessionCookieSameSite = readSessionCookieSameSite(env);
  if (sessionCookieSameSite === 'none' && !sessionCookieSecure) {
    throw new Error('SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true');
  }
  const sessionTtlDays = readInteger(
    env,
    'SESSION_TTL_DAYS',
    DEFAULT_SESSION_TTL_DAYS,
    MIN_SESSION_TTL_DAYS,
    MAX_SESSION_TTL_DAYS,
  );
  const argon2MemoryCost = readInteger(
    env,
    'ARGON2_MEMORY_COST',
    DEFAULT_ARGON2_MEMORY_COST,
    MIN_ARGON2_MEMORY_COST,
    MAX_ARGON2_MEMORY_COST,
  );
  const argon2TimeCost = readInteger(
    env,
    'ARGON2_TIME_COST',
    DEFAULT_ARGON2_TIME_COST,
    MIN_ARGON2_TIME_COST,
    MAX_ARGON2_TIME_COST,
  );
  const argon2Parallelism = readInteger(
    env,
    'ARGON2_PARALLELISM',
    DEFAULT_ARGON2_PARALLELISM,
    MIN_ARGON2_PARALLELISM,
    MAX_ARGON2_PARALLELISM,
  );
  const verificationTokenTtlHours = readInteger(
    env,
    'VERIFICATION_TOKEN_TTL_HOURS',
    24,
    1,
    168,
  );

  return {
    databaseUrl,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpConnectionTimeoutMs,
    appBaseUrl,
    allowedOrigin,
    sessionCookieSecure,
    sessionCookieSameSite,
    sessionTtlDays,
    sessionTtlMs: sessionTtlDays * 24 * 60 * 60 * 1000,
    argon2MemoryCost,
    argon2TimeCost,
    argon2Parallelism,
    verificationTokenTtlMs: verificationTokenTtlHours * 60 * 60 * 1000,
  };
}