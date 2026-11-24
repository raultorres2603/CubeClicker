import { describe, expect, it } from 'vitest';

import type { LogFields, LogSink } from './logging.js';
import { createMetrics } from './metrics.js';
import {
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
  exitCode(): Promise<number>;
}

/** An event-emitter stand-in that records listener registration and exit codes. */
function createFakeProcess(): FakeProcess {
  const listeners = new Map<ShutdownSignal, Array<() => void>>();
  const registered: ShutdownSignal[] = [];
  const exits: number[] = [];
  let resolveExit: (code: number) => void = () => {};
  const nextExit = new Promise<number>((resolve) => {
    resolveExit = resolve;
  });
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
      resolveExit(code);
    },
    emit(signal) {
      for (const listener of listeners.get(signal) ?? []) {
        listener();
      }
    },
    exitCode() {
      return nextExit;
    },
  };
}

/** A manually released promise, so a test can hold `beforeClose` in flight. */
function createGate(): { promise: Promise<void>; release: () => void } {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('installShutdownHandlers beforeClose', () => {
  it('awaits beforeClose before closing the app, in order, and exits 0', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const gate = createGate();
    const order: string[] = [];

    installShutdownHandlers({
      app: {
        close: async () => {
          order.push('app.close');
        },
      },
      metrics,
      log,
      beforeClose: async () => {
        order.push('beforeClose:start');
        await gate.promise;
        order.push('beforeClose:end');
      },
      process: proc,
    });

    proc.emit('SIGTERM');

    // The hook is awaited: the app is not closed and no completion is logged yet.
    expect(order).toEqual(['beforeClose:start']);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
    ]);
    expect(metrics.render()).toContain('cubeclicker_shutdown_total{signal="SIGTERM"} 1');

    gate.release();

    expect(await proc.exitCode()).toBe(0);
    expect(order).toEqual(['beforeClose:start', 'beforeClose:end', 'app.close']);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      { level: 'info', event: 'shutdown_complete', fields: { signal: 'SIGTERM' } },
    ]);
    expect(proc.exits).toEqual([0]);
  });

  it('runs beforeClose once and ignores signals while pending and after completion', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const gate = createGate();
    const order: string[] = [];
    let beforeCloseCalls = 0;
    let closeCalls = 0;

    installShutdownHandlers({
      app: {
        close: async () => {
          closeCalls += 1;
          order.push('app.close');
        },
      },
      metrics,
      log,
      beforeClose: async () => {
        beforeCloseCalls += 1;
        order.push('beforeClose');
        await gate.promise;
      },
      process: proc,
    });

    proc.emit('SIGTERM');
    proc.emit('SIGINT');
    proc.emit('SIGTERM');

    expect(beforeCloseCalls).toBe(1);
    expect(closeCalls).toBe(0);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
    ]);
    expect(metrics.render()).toContain('cubeclicker_shutdown_total{signal="SIGTERM"} 1');

    gate.release();
    expect(await proc.exitCode()).toBe(0);

    // A late signal after the process "exited" is inert.
    proc.emit('SIGINT');

    expect(beforeCloseCalls).toBe(1);
    expect(closeCalls).toBe(1);
    expect(proc.exits).toEqual([0]);
    expect(order).toEqual(['beforeClose', 'app.close']);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      { level: 'info', event: 'shutdown_complete', fields: { signal: 'SIGTERM' } },
    ]);
  });

  it('logs shutdown_failed and exits 1 without closing the app when beforeClose rejects', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const failure = new Error('cleanup stop failed');
    failure.name = 'CleanupError';
    let closeCalls = 0;

    installShutdownHandlers({
      app: {
        close: async () => {
          closeCalls += 1;
        },
      },
      metrics,
      log,
      beforeClose: () => Promise.reject(failure),
      process: proc,
    });

    proc.emit('SIGTERM');

    expect(await proc.exitCode()).toBe(1);
    expect(closeCalls).toBe(0);
    expect(proc.exits).toEqual([1]);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      {
        level: 'error',
        event: 'shutdown_failed',
        fields: { signal: 'SIGTERM', errorType: 'CleanupError' },
      },
    ]);
  });

  it('treats a synchronous beforeClose throw as a failure and exits 1', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    let closeCalls = 0;

    installShutdownHandlers({
      app: {
        close: async () => {
          closeCalls += 1;
        },
      },
      metrics,
      log,
      beforeClose: () => {
        throw new Error('cleanup exploded');
      },
      process: proc,
    });

    proc.emit('SIGTERM');

    expect(await proc.exitCode()).toBe(1);
    expect(closeCalls).toBe(0);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      {
        level: 'error',
        event: 'shutdown_failed',
        fields: { signal: 'SIGTERM', errorType: 'Error' },
      },
    ]);
  });

  it('still reports a close failure after beforeClose resolves', async () => {
    const metrics = createMetrics();
    const { log, entries } = createLogRecorder();
    const proc = createFakeProcess();
    const failure = new Error('server still closing');
    failure.name = 'ShutdownError';
    const order: string[] = [];

    installShutdownHandlers({
      app: {
        close: () => {
          order.push('app.close');
          return Promise.reject(failure);
        },
      },
      metrics,
      log,
      beforeClose: () => {
        order.push('beforeClose');
      },
      process: proc,
    });

    proc.emit('SIGTERM');

    expect(await proc.exitCode()).toBe(1);
    expect(order).toEqual(['beforeClose', 'app.close']);
    expect(proc.exits).toEqual([1]);
    expect(entries).toEqual([
      { level: 'info', event: 'shutdown_started', fields: { signal: 'SIGTERM' } },
      {
        level: 'error',
        event: 'shutdown_failed',
        fields: { signal: 'SIGTERM', errorType: 'ShutdownError' },
      },
    ]);
  });
});
