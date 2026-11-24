/**
 * In-process expired-verification cleanup scheduler (T5).
 *
 * After the backend listens, an expired `verification_tokens` row is removed by
 * running the existing parameterized `deleteExpired(nowMs)` once immediately and
 * then `intervalMs` after each run settles. The recursive `setTimeout` (never
 * `setInterval`) means the timer cannot fire while a run is pending; the
 * in-flight guard still protects direct `runOnce()` calls (and a duplicate
 * `start()` schedules no second chain). Timer handles are `unref()`ed so a
 * script or test process is not kept alive by a pending cleanup tick.
 *
 * Failures are non-fatal: `deleteExpired` rejecting logs
 * `db_verification_cleanup_failed` and the next interval is still scheduled, so
 * a transient database error never takes the request path down (D5/D7).
 *
 * Time and timers are injected so the scheduler is deterministic in tests: the
 * `now` clock feeds `deleteExpired(now)` and `durationMs`, and `timers` defaults
 * to the globals (fake timers in the unit suite).
 */

import type { VerificationTokenRepository } from '../auth/verification-token-repository.js';
import type { LogFields, LogSink } from '../observability/logging.js';

/** The timer functions the scheduler uses (fake timers in tests, globals in production). */
export interface CleanupTimerFns {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

/** The cleanup lifecycle the server wiring (T8) starts and stops. */
export interface VerificationCleanupScheduler {
  /** Starts the immediate run, then the recursive interval chain; idempotent. */
  start(): void;
  /** Clears the pending timer, awaits an in-flight run, then logs `stopped`; idempotent. */
  stop(): Promise<void>;
  /** Runs one delete attempt now; resolves with the deleted row count (`0` on skip/failure). */
  runOnce(): Promise<number>;
}

/** Timer handle shape that may or may not expose Node's `unref()`. */
interface MaybeUnrefable {
  unref?: () => void;
}

/** Dependencies and seams for {@link createVerificationCleanupScheduler}. */
export interface VerificationCleanupOptions {
  /** The repository surface used to delete expired tokens (`PgVerificationTokenRepository`). */
  repository: Pick<VerificationTokenRepository, 'deleteExpired'>;
  /** Delay between runs, measured from the previous run's settlement. */
  intervalMs: number;
  /** Event-first structured sink (the Fastify/Pino adapter in production). */
  log: LogSink;
  /** Clock seam; defaults to `Date.now`. */
  now?: () => number;
  /** Timer seam; defaults to the globals. */
  timers?: CleanupTimerFns;
}

/**
 * Maps a rejection to the log contract's `{ errorType, code? }` fields.
 *
 * The message and stack are deliberately dropped: both can contain SQL, query
 * parameters or data, and the contract allows only the type and the optional
 * string `code` (for example a PostgreSQL SQLSTATE).
 */
function errorFields(error: unknown): LogFields {
  if (!(error instanceof Error)) {
    return { errorType: 'unknown' };
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string'
    ? { errorType: error.name, code }
    : { errorType: error.name };
}

/**
 * Creates the expired-verification cleanup scheduler.
 *
 * `start()` runs once at 0 ms and then schedules each next attempt
 * `intervalMs` after the previous attempt settles, so a run taking `D` ms shifts
 * the following tick by `D` (no overlap from the timer itself).
 */
export function createVerificationCleanupScheduler(
  options: VerificationCleanupOptions,
): VerificationCleanupScheduler {
  const { repository, intervalMs, log } = options;
  const now = options.now ?? ((): number => Date.now());
  const timers: CleanupTimerFns = options.timers ?? { setTimeout, clearTimeout };

  let started = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<number> | null = null;

  /** Unrefs the handle when the runtime exposes it (Node), leaving test fakes alone. */
  function scheduleNext(delayMs: number): void {
    const handle = timers.setTimeout(() => {
      timer = null;
      if (!started) {
        return;
      }
      void tick();
    }, delayMs);
    (handle as MaybeUnrefable).unref?.();
    timer = handle;
  }

  /** Runs one attempt and schedules the next one only while still started. */
  async function tick(): Promise<void> {
    await runOnce();
    if (started) {
      scheduleNext(intervalMs);
    }
  }

  /** Performs one delete attempt; never rejects (a failure logs and resolves `0`). */
  async function execute(): Promise<number> {
    const startedAt = now();
    let deleted: number;
    try {
      deleted = await repository.deleteExpired(startedAt);
    } catch (error) {
      log.error('db_verification_cleanup_failed', errorFields(error));
      return 0;
    }
    const fields: LogFields = { deleted, durationMs: now() - startedAt };
    if (deleted > 0) {
      log.info('db_verification_cleanup_run', fields);
    } else {
      log.debug('db_verification_cleanup_run', fields);
    }
    return deleted;
  }

  /** Public one-shot run; a run already in flight is skipped and logged. */
  async function runOnce(): Promise<number> {
    if (inFlight !== null) {
      log.debug('db_verification_cleanup_skipped', { reason: 'in_flight' });
      return 0;
    }
    const run = execute();
    inFlight = run;
    try {
      return await run;
    } finally {
      if (inFlight === run) {
        inFlight = null;
      }
    }
  }

  function start(): void {
    if (started) {
      return;
    }
    started = true;
    log.info('db_verification_cleanup_started', { intervalMs });
    scheduleNext(0);
  }

  async function stop(): Promise<void> {
    const wasStarted = started;
    started = false;
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    const pending = inFlight;
    if (pending !== null) {
      await pending;
    }
    if (wasStarted) {
      log.info('db_verification_cleanup_stopped', {});
    }
  }

  return { start, stop, runOnce };
}
