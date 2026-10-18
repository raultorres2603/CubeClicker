/**
 * Single owner of the client-side WebSocket connection lifecycle
 * (connect → open → drop → bounded retry → teardown).
 *
 * Deliberately DOM-free and side-effect-free apart from the socket it creates: the
 * socket factory is injectable so tests can drive transitions with a fake socket,
 * and all timing goes through the ambient `setTimeout`/`clearTimeout`.
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface ConnectionOptions {
  url: string;
  /** Injected in tests; defaults to `(url) => new WebSocket(url)`. */
  socketFactory?: (url: string) => WebSocket;
  /** Maximum number of retries before giving up. Default 10. */
  maxAttempts?: number;
  /** First retry delay in ms; doubles per attempt. Default 500. */
  baseDelayMs?: number;
  /** Upper bound for a single retry delay in ms. Default 5000. */
  maxDelayMs?: number;
  onStatus?: (status: ConnectionStatus) => void;
}

export interface Connection {
  close(): void;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5000;

function defaultSocketFactory(url: string): WebSocket {
  return new WebSocket(url);
}

export function createConnection(options: ConnectionOptions): Connection {
  const { url, onStatus } = options;
  const socketFactory = options.socketFactory ?? defaultSocketFactory;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  /** Teardown latch: once closed, no retry and no status change may follow. */
  let closed = false;
  /** Consecutive failed attempts since the last successful open. */
  let attempt = 0;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(status: ConnectionStatus): void {
    if (closed) {
      return;
    }
    onStatus?.(status);
  }

  function attach(current: WebSocket): void {
    // A socket can emit `error` and then `close`; only the first event consumes an attempt.
    let dropped = false;

    const handleDrop = (): void => {
      if (closed || dropped) {
        return;
      }
      dropped = true;
      if (socket === current) {
        socket = null;
      }
      setStatus('disconnected');
      scheduleRetry();
    };

    current.onopen = () => {
      if (closed) {
        return;
      }
      attempt = 0;
      setStatus('connected');
    };
    current.onerror = handleDrop;
    current.onclose = handleDrop;
  }

  function scheduleRetry(): void {
    attempt += 1;
    if (attempt > maxAttempts) {
      return; // Bounded: the cap is reached, the connection stays `disconnected`.
    }
    const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, delay);
  }

  function open(): void {
    if (closed) {
      return;
    }
    setStatus('connecting');
    const next = socketFactory(url);
    socket = next;
    attach(next);
  }

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    const current = socket;
    socket = null;
    if (current !== null) {
      current.onopen = null;
      current.onclose = null;
      current.onerror = null;
      current.close();
    }
  }

  open();

  return { close };
}
