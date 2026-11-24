/**
 * Graceful-shutdown handlers (T3, AC-17).
 *
 * Installed after `listen` by `server.ts`. A `SIGTERM`/`SIGINT` is handled once:
 * the event is logged, counted, an optional `beforeClose` hook is awaited, then
 * `app.close()` runs (the existing hub/pool `onClose` teardown closes WebSocket
 * clients), then the process exits. A second signal during shutdown is ignored;
 * a hook or close failure logs `shutdown_failed` and exits non-zero. Both the
 * process and the signals are injectable so tests never touch the real process.
 */

import type { LogSink } from './logging.js';
import type { Metrics } from './metrics.js';

/** The two signals the process handles (and the catalog's allow-list). */
export type ShutdownSignal = 'SIGTERM' | 'SIGINT';

/** The app surface shutdown needs. */
export interface ShutdownApp {
  close(): Promise<void>;
}

/** The process surface shutdown needs (Node's `process` satisfies it). */
export interface ShutdownProcess {
  on(signal: ShutdownSignal, listener: () => void): unknown;
  exit(code: number): void;
}

/** Options for {@link installShutdownHandlers}. */
export interface InstallShutdownHandlersOptions {
  app: ShutdownApp;
  metrics: Metrics;
  log: LogSink;
  /**
   * Optional teardown awaited once before `app.close()` (for example stopping
   * the expired-token cleanup scheduler before the pool is closed). A rejection
   * fails the shutdown: `shutdown_failed` is logged, `app.close()` is skipped and
   * the process exits `1`.
   */
  beforeClose?: () => void | Promise<void>;
  /** Test seam: defaults to the real `process`. */
  process?: ShutdownProcess;
  /** Test seam: defaults to `['SIGTERM', 'SIGINT']`. */
  signals?: readonly ShutdownSignal[];
}

/** Signals handled by default, in registration order. */
export const DEFAULT_SHUTDOWN_SIGNALS: readonly ShutdownSignal[] = ['SIGTERM', 'SIGINT'];

/** Resolves a thrown value to the `errorType` log field (never the message). */
function errorTypeOf(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}

/** Runs a teardown step, normalizing a synchronous throw into a rejection. */
function settle(step: () => void | Promise<void>): Promise<void> {
  try {
    return Promise.resolve(step());
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Registers one-shot `SIGTERM`/`SIGINT` handlers.
 *
 * The first signal logs `shutdown_started`, increments
 * `cubeclicker_shutdown_total{signal}`, awaits `beforeClose` when supplied,
 * closes the app, logs `shutdown_complete` and exits `0`. Any later signal is
 * ignored. A failed hook or close logs `shutdown_failed { signal, errorType }`
 * and exits `1`; a hook failure skips `app.close()`.
 */
export function installShutdownHandlers(options: InstallShutdownHandlersOptions): void {
  const target = options.process ?? process;
  const signals = options.signals ?? DEFAULT_SHUTDOWN_SIGNALS;
  let closing = false;

  for (const signal of signals) {
    target.on(signal, () => {
      if (closing) {
        return;
      }
      closing = true;
      options.log.info('shutdown_started', { signal });
      options.metrics.inc('cubeclicker_shutdown_total', { signal });

      // Normalize synchronous throws into rejections so every failure path shares
      // the same handling. Without `beforeClose`, `close()` is still invoked
      // synchronously, preserving the pre-hook behavior.
      const beforeClose = options.beforeClose;
      const closed =
        beforeClose === undefined
          ? settle(() => options.app.close())
          : settle(beforeClose).then(() => options.app.close());

      void closed.then(
        () => {
          options.log.info('shutdown_complete', { signal });
          target.exit(0);
        },
        (error: unknown) => {
          options.log.error('shutdown_failed', {
            signal,
            errorType: errorTypeOf(error),
          });
          target.exit(1);
        },
      );
    });
  }
}
