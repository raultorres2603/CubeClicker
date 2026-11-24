import { describe, expect, it } from 'vitest';

import { createMetrics } from './metrics.js';
import type { LogFields, LogSink } from './logging.js';
import {
  DEFAULT_SHUTDOWN_SIGNALS,
  installShutdownHandlers,
  type ShutdownProcess,
  type ShutdownSignal,
} from './shutdown.js';

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

interface FakeProcess extends ShutdownProcess {
  registered: ShutdownSignal[];
  exits: number[];
  emit(signal: ShutdownSignal): void;
}

/** An event-emitter stand-in that records listener registration and exit codes. */
function createFakeProcess(onExit?: (code: number) => void): FakeProcess {
  const listeners = new Map<ShutdownSignal, Array<() => void>>();
  const registered: ShutdownSignal[] = [];
  const exits: number[] = [];
  return {
    registered,
    exits,
    on(signal, listener) {
      registered.push(signal);
      const list = listeners.get(signal) ?? [];
      list.push(listener);
      listeners.set(signal, list);
      return this;
    },
    exit(code) {
      exits.push(code);
      onExit?.(code);
    },
    emit(signal) {
      for (const listener of listeners.get(signal) ?? []) {
        listener();
      }
    },
  };
}

/** Resolves with the first exit code the fake process records. */
function exited(proc: FakeProcess): Promise<number> {
  return new Promise<number>((resolve) => {
    const original = proc.exit.bind(proc);
    proc.exit = (code: number): void => {
      original(code);
      resolve(code);
    };
    const alreadyExited = proc.exits[0];
    if (alreadyExited !== undefined) {
      resolve(alreadyExited);
    }
  });
}

describe('installShutdownHandlers', () => {
  it('registers SIGTERM and SIGINT once, logs, counts, closes once and exits 0', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    let closeCalls = 0;
    const exitCode = exited(proc);

    installShutdownHandlers({
      app: {
        close: async () => {
          closeCalls += 1;
        },
      },
      metrics,
      log,
      process: proc,
    });

    expect(proc.registered).toEqual(['SIGTERM', 'SIGINT']);
    expect(DEFAULT_SHUTDOWN_SIGNALS).toEqual(['SIGTERM', 'SIGINT']);

    proc.emit('SIGTERM');

    expect(await exitCode).toBe(0);
    expect(closeCalls).toBe(1);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      { level: 'info', event: 'shutdown_complete', fields: { signal: 'SIGTERM' } },
    ]);
    expect(metrics.render()).toContain('cubeclicker_shutdown_total{signal="SIGTERM"} 1');
  });

  it('handles SIGINT with the matching counter label', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const exitCode = exited(proc);

    installShutdownHandlers({ app: { close: async () => {} }, metrics, log, process: proc });

    proc.emit('SIGINT');

    expect(await exitCode).toBe(0);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGINT' } },
      { level: 'info', event: 'shutdown_complete', fields: { signal: 'SIGINT' } },
    ]);
    expect(metrics.render()).toContain('cubeclicker_shutdown_total{signal="SIGINT"} 1');
    expect(metrics.render()).not.toContain('cubeclicker_shutdown_total{signal="SIGTERM"}');
  });

  it('ignores a second signal while shutting down and any signal after completion', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    let closeCalls = 0;
    let releaseClose: () => void = () => {};
    const closed = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });
    const exitCode = exited(proc);

    installShutdownHandlers({
      app: {
        close: async () => {
          closeCalls += 1;
          await closed;
        },
      },
      metrics,
      log,
      process: proc,
    });

    proc.emit('SIGTERM');
    proc.emit('SIGINT');
    proc.emit('SIGTERM');

    // The concurrent signals neither close again nor log another start.
    expect(closeCalls).toBe(1);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
    ]);
    expect(metrics.render()).toContain('cubeclicker_shutdown_total{signal="SIGTERM"} 1');

    releaseClose();
    expect(await exitCode).toBe(0);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      { level: 'info', event: 'shutdown_complete', fields: { signal: 'SIGTERM' } },
    ]);

    // A late signal after the process "exited" is inert.
    proc.emit('SIGINT');
    expect(proc.exits).toEqual([0]);
    expect(closeCalls).toBe(1);
    expect(entries).toHaveLength(2);
  });

  it('logs shutdown_failed with the error type and exits 1 when close rejects', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const failure = new Error('server still closing');
    failure.name = 'ShutdownError';
    const exitCode = exited(proc);

    installShutdownHandlers({
      app: { close: () => Promise.reject(failure) },
      metrics,
      log,
      process: proc,
    });

    proc.emit('SIGTERM');

    expect(await exitCode).toBe(1);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      {
        level: 'error',
        event: 'shutdown_failed',
        fields: { signal: 'SIGTERM', errorType: 'ShutdownError' },
      },
    ]);
    expect(entries.some((entry) => entry.event === 'shutdown_complete')).toBe(false);
  });

  it('treats a synchronous close throw as a failure and exits 1', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const exitCode = exited(proc);

    installShutdownHandlers({
      app: {
        close: () => {
          throw new Error('close exploded');
        },
      },
      metrics,
      log,
      process: proc,
    });

    proc.emit('SIGTERM');

    expect(await exitCode).toBe(1);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      {
        level: 'error',
        event: 'shutdown_failed',
        fields: { signal: 'SIGTERM', errorType: 'Error' },
      },
    ]);
  });

  it('treats a non-Error rejection as an unknown error type', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const exitCode = exited(proc);

    installShutdownHandlers({
      app: { close: () => Promise.reject('close-failed') },
      metrics,
      log,
      process: proc,
    });

    proc.emit('SIGTERM');

    expect(await exitCode).toBe(1);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      {
        level: 'error',
        event: 'shutdown_failed',
        fields: { signal: 'SIGTERM', errorType: 'unknown' },
      },
    ]);
  });

  it('registers only the injected signal list when one is supplied', async () => {
    const metrics = createMetrics();
    const { log } = createLogRecorder();
    const proc = createFakeProcess();
    const exitCode = exited(proc);

    installShutdownHandlers({
      app: { close: async () => {} },
      metrics,
      log,
      process: proc,
      signals: ['SIGINT'],
    });

    expect(proc.registered).toEqual(['SIGINT']);

    proc.emit('SIGINT');

    expect(await exitCode).toBe(0);
    expect(metrics.render()).toContain('cubeclicker_shutdown_total{signal="SIGINT"} 1');
  });
});
