/**
 * Backend game configuration (T1).
 *
 * Pure environment parsing: the only input is the environment object handed in by the
 * caller (`process.env` at the composition root), so this module has no side effects and
 * is fully unit-testable. Values are pinned by spec § Pinned constants; env-configurable
 * values are `MAX_USERS_PER_SERVER` and `RECONNECT_GRACE_MS`, everything else is fixed.
 */

/** Pinned default capacity X (spec § 2, plan § Capacity analysis: X = 10). */
export const DEFAULT_MAX_USERS_PER_SERVER = 10;
/** Pinned lower bound of the capacity range (spec § Pinned constants: valid 2–24). */
export const MIN_USERS_PER_SERVER = 2;
/** Pinned upper bound of the capacity range (spec § Pinned constants: valid 2–24). */
export const MAX_USERS_PER_SERVER = 24;

/** Pinned default reconnect grace window, in milliseconds. */
export const DEFAULT_RECONNECT_GRACE_MS = 30_000;
/** Pinned lower bound of the grace window (spec § Pinned constants: valid 1000–600000). */
export const MIN_RECONNECT_GRACE_MS = 1_000;
/** Pinned upper bound of the grace window (spec § Pinned constants: valid 1000–600000). */
export const MAX_RECONNECT_GRACE_MS = 600_000;

/** Pinned per-member explode cap (spec § Pinned constants: 30/s). */
export const CLICK_RATE_LIMIT_PER_SECOND = 30;
/** Pinned WS protocol ping interval (spec § Pinned constants: 30 000 ms). */
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
/** Pinned missed-pong termination threshold (spec § Pinned constants: 2). */
export const WS_MISSED_PONGS_LIMIT = 2;
/** Pinned socket cap (spec § Pinned constants: 200 connections). */
export const MAX_CONNECTIONS = 200;
/**
 * Pinned message-size cap in bytes (spec § Pinned constants: 1024). The exported codec
 * constant lives in `game/protocol.ts` (T4); `config` carries the same pinned value so
 * the hub reads all limits from one object.
 */
const MESSAGE_SIZE_CAP_BYTES = 1024;

/** The validated runtime configuration handed to the hub. */
export interface GameConfig {
  /** Server capacity X: default 10, valid integer 2–24. */
  maxUsersPerServer: number;
  /** Reconnect grace window: default 30 000 ms, valid integer 1000–600 000. */
  reconnectGraceMs: number;
  /** Explode cap per member per trailing second (30). */
  clickRateLimitPerSecond: number;
  /** WS protocol ping interval in milliseconds (30 000). */
  heartbeatIntervalMs: number;
  /** Consecutive missed pongs that terminate a socket (2). */
  missedPongsLimit: number;
  /** Maximum accepted client message size in bytes (1024). */
  maxMessageBytes: number;
  /** Maximum concurrently attached sockets (200). */
  maxConnections: number;
}

/**
 * Reads a pinned integer env variable. `undefined` means "not set" and yields the pinned
 * default; any other non-decimal-integer string (including an empty string) is a startup
 * failure naming the variable, per spec AC-5.
 */
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
 * Parses and validates the game configuration from an environment object.
 *
 * Throws (naming the variable) for a non-integer or out-of-range value, so startup fails
 * loudly instead of running with an unintended capacity.
 */
export function loadGameConfig(env: Record<string, string | undefined>): GameConfig {
  return {
    maxUsersPerServer: readInteger(
      env,
      'MAX_USERS_PER_SERVER',
      DEFAULT_MAX_USERS_PER_SERVER,
      MIN_USERS_PER_SERVER,
      MAX_USERS_PER_SERVER,
    ),
    reconnectGraceMs: readInteger(
      env,
      'RECONNECT_GRACE_MS',
      DEFAULT_RECONNECT_GRACE_MS,
      MIN_RECONNECT_GRACE_MS,
      MAX_RECONNECT_GRACE_MS,
    ),
    clickRateLimitPerSecond: CLICK_RATE_LIMIT_PER_SECOND,
    heartbeatIntervalMs: WS_HEARTBEAT_INTERVAL_MS,
    missedPongsLimit: WS_MISSED_PONGS_LIMIT,
    maxMessageBytes: MESSAGE_SIZE_CAP_BYTES,
    maxConnections: MAX_CONNECTIONS,
  };
}
