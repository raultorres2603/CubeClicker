/**
 * Cleanup scheduler unit tests (T5, AC-15, AC-18, AC-19, AC-23).
 *
 * The scheduler runs under Vitest's fake timers with an injected clock and a
 * recording `LogSink`, so every run happens at an exact fake instant and every
 * assertion pins the emitted event, level and fields. The real-Postgres proof
 * (expired-only deletion, account/session preservation, concurrent idempotence)
 * lives in `verification-cleanup-postgres.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogFields, LogSink } from '../observability/logging.js';
import {
  type CleanupTimerFns,
  createVerificationCleanupScheduler,
} from './verification-cleanup.js';

const INTERVAL_MS = 3_600_000;

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

function createLogRecorder(): { log: LogSink; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    log: {
      debug: (event, fields) => entries.push({ level: 'debug', event, fields }),
      info: (event, fields) => entries.push({ level: 'info', event, fields }),
      warn: (event, fields) => entries.push({ level: 'warn', event, fields }),
      error: (event, fields) => entries.push({ level: 'error', event, fields }),
    },
  };
}

/** A `deleteExpired` fake recording each clock argument and returning the queued counts. */
function createRepository(results: number[] = []): {
  repository: { deleteExpired: (nowMs?: number) => Promise<number> };
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    repository: {
      async deleteExpired(nowMs?: number): Promise<number> {
        calls.push(nowMs ?? Number.NaN);
        return results.shift() ?? 0;
      },
    },
  };
}

/** A deferred promise the test resolves to model a slow database. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Flushes the scheduler's promise chain without advancing fake time. */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

interface ManualTimer {
  callback: () => void;
  delayMs: number;
  unrefCalls: number;
  cleared: boolean;
}

/** A hand-driven timer seam proving unref/clear are applied to each handle. */
function createManualTimers(): { timers: CleanupTimerFns; created: ManualTimer[] } {
  const created: ManualTimer[] = [];
  const timers: CleanupTimerFns = {
    setTimeout: ((callback: () => void, delay?: number) => {
      const timer: ManualTimer = {
        callback,
        delayMs: delay ?? 0,
        unrefCalls: 0,
        cleared: false,
      };
      created.push(timer);
      return {
        unref: () => {
          timer.unrefCalls += 1;
        },
        timer,
      } as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeout: ((handle: ReturnType<typeof setTimeout>) => {
      (handle as unknown as { timer: ManualTimer }).timer.cleared = true;
    }) as typeof clearTimeout,
  };
  return { timers, created };
}

const STARTED: LogEntry = {
  level: 'info',
  event: 'db_verification_cleanup_started',
  fields: { intervalMs: INTERVAL_MS },
};
const STOPPED: LogEntry = {
  level: 'info',
  event: 'db_verification_cleanup_stopped',
  fields: {},
};
const SKIPPED: LogEntry = {
  level: 'debug',
  event: 'db_verification_cleanup_skipped',
  fields: { reason: 'in_flight' },
};
const FAILED: LogEntry = {
  level: 'error',
  event: 'db_verification_cleanup_failed',
  fields: { errorType: 'Error' },
};

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createVerificationCleanupScheduler — cadence and events (AC-15)', () => {
  it('runs immediately then at each interval, logging zero deletes at debug, and stops', async () => {
    const { log, entries } = createLogRecorder();
    const { repository, calls } = createRepository([0, 0, 0]);
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    scheduler.start();
    expect(entries).toEqual([STARTED]);

    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0]);
    expect(entries).toEqual([
      STARTED,
      {
        level: 'debug',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 0, durationMs: 0 },
      },
    ]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(calls).toEqual([0, INTERVAL_MS]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(calls).toEqual([0, INTERVAL_MS, 2 * INTERVAL_MS]);
    expect(entries).toHaveLength(4);

    await scheduler.stop();
    expect(entries).toEqual([
      STARTED,
      { level: 'debug', event: 'db_verification_cleanup_run', fields: { deleted: 0, durationMs: 0 } },
      { level: 'debug', event: 'db_verification_cleanup_run', fields: { deleted: 0, durationMs: 0 } },
      { level: 'debug', event: 'db_verification_cleanup_run', fields: { deleted: 0, durationMs: 0 } },
      STOPPED,
    ]);

    await vi.advanceTimersByTimeAsync(2 * INTERVAL_MS);
    expect(calls).toEqual([0, INTERVAL_MS, 2 * INTERVAL_MS]);
  });

  it('logs a positive delete at info and uses the injected clock', async () => {
    const { log, entries } = createLogRecorder();
    const { repository, calls } = createRepository([2]);
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
      now: () => 1_000,
    });

    expect(await scheduler.runOnce()).toBe(2);
    expect(calls).toEqual([1_000]);
    expect(entries).toEqual([
      {
        level: 'info',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 2, durationMs: 0 },
      },
    ]);
  });

  it('schedules the next run intervalMs after a slow run settles', async () => {
    const { log, entries } = createLogRecorder();
    const gate = deferred();
    const calls: number[] = [];
    const repository = {
      async deleteExpired(nowMs?: number): Promise<number> {
        calls.push(nowMs ?? Number.NaN);
        await gate.promise;
        return 1;
      },
    };
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0]);

    // The run takes 500 ms; no next timer exists until it settles.
    await vi.advanceTimersByTimeAsync(500);
    gate.resolve();
    await flushMicrotasks();

    expect(entries).toEqual([
      STARTED,
      {
        level: 'info',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 1, durationMs: 500 },
      },
    ]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS - 1);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([0, INTERVAL_MS + 500]);
  });

  it('starts one chain for a duplicate start and logs stopped once for a duplicate stop', async () => {
    const { log, entries } = createLogRecorder();
    const { repository, calls } = createRepository([0, 0]);
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    scheduler.start();
    scheduler.start();
    expect(entries).toEqual([STARTED]);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(calls).toEqual([0, INTERVAL_MS]);

    await scheduler.stop();
    await scheduler.stop();
    expect(entries.filter((entry) => entry.event === 'db_verification_cleanup_stopped')).toEqual([
      STOPPED,
    ]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(calls).toEqual([0, INTERVAL_MS]);
  });
});

describe('createVerificationCleanupScheduler — failure isolation (AC-18)', () => {
  it('logs the failure, resolves 0 and keeps scheduling the next interval', async () => {
    const { log, entries } = createLogRecorder();
    let attempts = 0;
    const repository = {
      async deleteExpired(): Promise<number> {
        attempts += 1;
        throw new Error('cleanup boom');
      },
    };
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(attempts).toBe(1);
    expect(entries).toEqual([STARTED, FAILED]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(attempts).toBe(2);
    expect(entries).toEqual([STARTED, FAILED, FAILED]);
  });

  it('carries only errorType and an optional string code', async () => {
    const coded = new Error('constraint violation') as Error & { code?: unknown };
    coded.code = '23514';
    const { log, entries } = createLogRecorder();
    const codedScheduler = createVerificationCleanupScheduler({
      repository: { deleteExpired: async () => Promise.reject(coded) },
      intervalMs: INTERVAL_MS,
      log,
    });

    expect(await codedScheduler.runOnce()).toBe(0);
    expect(entries).toEqual([
      {
        level: 'error',
        event: 'db_verification_cleanup_failed',
        fields: { errorType: 'Error', code: '23514' },
      },
    ]);

    const { log: stringLog, entries: stringEntries } = createLogRecorder();
    const stringScheduler = createVerificationCleanupScheduler({
      repository: { deleteExpired: async () => Promise.reject('cleanup-failed') },
      intervalMs: INTERVAL_MS,
      log: stringLog,
    });

    expect(await stringScheduler.runOnce()).toBe(0);
    expect(stringEntries).toEqual([
      {
        level: 'error',
        event: 'db_verification_cleanup_failed',
        fields: { errorType: 'unknown' },
      },
    ]);
  });
});

describe('createVerificationCleanupScheduler — overlap guard and stop (AC-19)', () => {
  it('skips a second direct run while the first direct run is still pending', async () => {
    const { log, entries } = createLogRecorder();
    const gate = deferred();
    const calls: number[] = [];
    const repository = {
      async deleteExpired(nowMs?: number): Promise<number> {
        calls.push(nowMs ?? Number.NaN);
        await gate.promise;
        return 0;
      },
    };
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    const first = scheduler.runOnce();
    expect(await scheduler.runOnce()).toBe(0);
    expect(calls).toEqual([0]);
    expect(entries).toEqual([SKIPPED]);

    gate.resolve();
    expect(await first).toBe(0);
    expect(entries).toEqual([
      SKIPPED,
      {
        level: 'debug',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 0, durationMs: 0 },
      },
    ]);
  });

  it('skips a direct run while a timer run is in flight and schedules from the pending run', async () => {
    const { log, entries } = createLogRecorder();
    const gate = deferred();
    const calls: number[] = [];
    const repository = {
      async deleteExpired(nowMs?: number): Promise<number> {
        calls.push(nowMs ?? Number.NaN);
        if (calls.length === 1) {
          await gate.promise;
        }
        return 2;
      },
    };
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0]);

    expect(await scheduler.runOnce()).toBe(0);
    expect(calls).toEqual([0]);
    expect(entries).toEqual([STARTED, SKIPPED]);

    gate.resolve();
    await flushMicrotasks();
    expect(entries).toEqual([
      STARTED,
      SKIPPED,
      {
        level: 'info',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 2, durationMs: 0 },
      },
    ]);

    // The completed run scheduled the next timer, not the skipped direct call.
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(calls).toEqual([0, INTERVAL_MS]);
  });

  it('stop awaits an in-flight run, clears the next timer and schedules nothing afterwards', async () => {
    const { log, entries } = createLogRecorder();
    const gate = deferred();
    let calls = 0;
    const repository = {
      async deleteExpired(): Promise<number> {
        calls += 1;
        await gate.promise;
        return 1;
      },
    };
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: INTERVAL_MS,
      log,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);

    let settled = false;
    const stopped = scheduler.stop().then(() => {
      settled = true;
    });
    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(entries).toEqual([STARTED]);

    gate.resolve();
    await stopped;
    expect(entries).toEqual([
      STARTED,
      {
        level: 'info',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 1, durationMs: 0 },
      },
      STOPPED,
    ]);

    await vi.advanceTimersByTimeAsync(2 * INTERVAL_MS);
    expect(calls).toBe(1);
  });

  it('unrefs each handle, clears the pending timer on stop and ignores a stale callback', async () => {
    const { log, entries } = createLogRecorder();
    const { timers, created } = createManualTimers();
    const calls: number[] = [];
    const scheduler = createVerificationCleanupScheduler({
      repository: {
        async deleteExpired(nowMs?: number): Promise<number> {
          calls.push(nowMs ?? Number.NaN);
          return 0;
        },
      },
      intervalMs: 10,
      log,
      now: () => 0,
      timers,
    });

    scheduler.start();
    expect(created).toHaveLength(1);
    expect(created[0]!.delayMs).toBe(0);
    expect(created[0]!.unrefCalls).toBe(1);

    created[0]!.callback();
    await flushMicrotasks();
    expect(calls).toEqual([0]);
    expect(created).toHaveLength(2);
    expect(created[1]!.delayMs).toBe(10);
    expect(created[1]!.unrefCalls).toBe(1);

    await scheduler.stop();
    expect(created[1]!.cleared).toBe(true);
    expect(entries).toEqual([
      {
        level: 'info',
        event: 'db_verification_cleanup_started',
        fields: { intervalMs: 10 },
      },
      { level: 'debug', event: 'db_verification_cleanup_run', fields: { deleted: 0, durationMs: 0 } },
      STOPPED,
    ]);

    // A callback that escapes clearTimeout must not start a run after stop.
    created[1]!.callback();
    await flushMicrotasks();
    expect(calls).toEqual([0]);
    expect(created).toHaveLength(2);
  });
});
