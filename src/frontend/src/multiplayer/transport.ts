/**
 * The multiplayer transport (T9) — the client's single owner of the session protocol on
 * top of the accepted retry connection.
 *
 * Layer: `multiplayer/transport.ts`. It wraps `ws/connection.ts` (unchanged): the retry
 * connection owns connect → open → drop → bounded retry → teardown, and this module owns
 * everything that is *session*, not socket: the join/resume handshake, the in-memory
 * session token, the send path and the status the banner reads.
 *
 * **Handshake.** The server sends exactly one `hello` as the first frame of every
 * connection (AC-20). On each `hello` the transport answers with `rejoin { token }` when it
 * holds a token from a previous `welcome`, else with `join` — so a fresh page joins and a
 * reconnect within the grace window resumes the same identity (AC-22). A `hello` repeats on
 * the *next* connection, not on the same one; a duplicate `hello` on one socket is ignored.
 * `error resume_failed` means the token is dead: the transport forgets it and sends `join`
 * on that same socket (spec § 8), so the following reconnect starts from a fresh identity.
 *
 * **Token.** Held in this closure only, learned from the last `welcome` (the server is the
 * only source of identities). Nothing is written to storage — no localStorage, no
 * sessionStorage, no cookies (AC-6) — and it survives `close()`/`connect()` so the pinned
 * `Retry` path can still resume within the grace window.
 *
 * **Frames.** Received frames are decoded with the mirrored codec, `parseServerMessage`
 * (T7), which never throws: a non-JSON frame, an unknown type or a malformed payload is
 * dropped silently. Every decoded frame (including `hello`) is handed to `onMessage`
 * subscribers after the transport's own protocol reaction. All catalog messages travel as
 * one JSON text frame; non-text frames are ignored. The backend's `MAX_MESSAGE_BYTES` cap
 * guards *its* receive path (client → server) and is deliberately not applied here: server
 * frames (`welcome`, `stateSync`) legitimately carry a full roster and can exceed it.
 *
 * **Status.** `ws/connection.ts` reports `connecting | connected | disconnected`; this
 * module adds `exhausted` for "the bounded retry budget is spent" by mirroring the same
 * attempt cap. `Retry` is `close()` then `connect()` (the pinned reconnect path). Statuses
 * are published only for connection events; a deliberate `close()` reports nothing. A
 * subscriber that attaches after the first event immediately receives the current status,
 * so a late-rendering banner can never stay on its initial value.
 *
 * **Send.** Client messages are encoded with `encodeClientMessage` and written only while a
 * socket is open; before the first open, between attempts and after `close()` a `send` is a
 * no-op (the session gates gameplay on the status anyway).
 */

import {
  encodeClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from './protocol';
import { createConnection, type ConnectionStatus } from '../ws/connection';

/** The status the connection banner renders (spec § 9; `exhausted` = retries spent). */
export type TransportStatus = 'connecting' | 'connected' | 'disconnected' | 'exhausted';

/** The handle the session and the UI hold. */
export interface Transport {
  /** Starts the connection (idempotent while one is live). */
  connect(): void;
  /** Tears the current connection down; a later `connect()` starts a fresh cycle. */
  close(): void;
  /** Sends one client message; a no-op while no socket is open. */
  send(message: ClientMessage): void;
  /** Deferred join entry point: chooses guest/account mode after an explicit menu choice (AC-34). */
  join(mode: 'guest' | 'account'): void;
  /** Subscribes to decoded server messages; the returned function unsubscribes. */
  onMessage(handler: (message: ServerMessage) => void): () => void;
  /** Subscribes to status changes (the current status is replayed on subscription). */
  onStatus(handler: (status: TransportStatus) => void): () => void;
}

/** Construction options; `url` and the socket factory are both injectable. */
export interface TransportOptions {
  /** WebSocket URL; defaults to `VITE_WS_URL` (via `import.meta.env`), else the pinned dev URL. */
  url?: string;
  /** Injected in tests / non-browser hosts; defaults to `(url) => new WebSocket(url)`. */
  socketFactory?: (url: string) => WebSocket;
  /** Seed for the first resume attempt; normally learned from the last `welcome`. */
  token?: string | null;
  /** Retry cap passed to the connection; default 10, matching `ws/connection.ts`. */
  maxAttempts?: number;
  /** First retry delay in ms; default 500, matching `ws/connection.ts`. */
  baseDelayMs?: number;
  /** Upper bound for one retry delay in ms; default 5000, matching `ws/connection.ts`. */
  maxDelayMs?: number;
}

/** Pinned default: the backend's published dev port (`README.md` configuration table). */
const DEFAULT_WS_URL = 'ws://localhost:8080/ws';

/**
 * Defaults mirrored from `ws/connection.ts` (its constants are private). The retry cap must
 * be identical on both sides: the connection decides when to stop retrying, the transport
 * uses the same number to report `exhausted` instead of `disconnected`.
 */
const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5000;

/** `VITE_WS_URL` when configured, else the pinned local URL (the same default as `vite.config.ts`). */
function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL;
  return typeof configured === 'string' && configured.length > 0 ? configured : DEFAULT_WS_URL;
}

/** The ambient browser socket factory (the only host global the transport touches). */
function defaultSocketFactory(url: string): WebSocket {
  return new WebSocket(url);
}

export function createTransport(options: TransportOptions = {}): Transport {
  const socketFactory = options.socketFactory ?? defaultSocketFactory;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  const messageHandlers = new Set<(message: ServerMessage) => void>();
  const statusHandlers = new Set<(status: TransportStatus) => void>();

  /** The session token from the last `welcome`; memory only, survives reconnect cycles. */
  let token: string | null = options.token ?? null;
  /** The last explicitly chosen join mode; retained across reconnects for the fallback join. */
  let lastMode: 'guest' | 'account' | null = null;
  /** The live retry connection, or `null` while detached. */
  let connection: ReturnType<typeof createConnection> | null = null;
  /** The socket the current attempt is using (stale frames compare against it). */
  let latestSocket: WebSocket | null = null;
  /** The socket client frames may be written to — only set once a socket is open. */
  let sendTarget: WebSocket | null = null;
  /** Whether the current socket already answered its `hello` (one join/rejoin per socket). */
  let helloHandled = false;
  /** Whether the current socket has already performed its join/rejoin handshake. */
  let joined = false;
  /** Consecutive drops since the last open, mirrored against the connection's attempt cap. */
  let drops = 0;
  /** True between `connect()` and `close()` (guards re-entrant lifecycle calls). */
  let active = false;
  /** The last published status; replayed to subscribers that arrive late. */
  let latestStatus: TransportStatus | null = null;

  function publishStatus(status: TransportStatus): void {
    latestStatus = status;
    for (const handler of statusHandlers) {
      handler(status);
    }
  }

  /** Detaches the current socket's frame handler and drops both socket references. */
  function releaseSocket(): void {
    sendTarget = null;
    const socket = latestSocket;
    latestSocket = null;
    if (socket !== null) {
      socket.onmessage = null;
    }
  }

  function send(message: ClientMessage): void {
    const target = sendTarget;
    if (target === null) {
      return;
    }
    target.send(encodeClientMessage(message));
  }

  /** The transport's own reaction to an authoritative frame (runs before subscribers). */
  function reactToServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'hello':
        if (helloHandled) {
          return; // one handshake per socket; a duplicated hello must not double-join
        }
        helloHandled = true;
        if (token !== null) {
          joined = true;
          send({ type: 'rejoin', token });
        } else if (lastMode !== null) {
          joined = true;
          send({ type: 'join', mode: lastMode });
        }
        // First connection: send nothing until an explicit transport.join(mode).
        return;

      case 'welcome':
        // A welcome (join or resume) is the only issuer of the token used for resume.
        token = message.token;
        joined = true;
        return;

      case 'error':
        if (message.code !== 'resume_failed') {
          return;
        }
        // The token is dead (unknown/expired): forget it and join fresh on this socket.
        token = null;
        joined = true;
        if (lastMode !== null) {
          send({ type: 'join', mode: lastMode });
        } else {
          send({ type: 'join' });
        }
        return;

      default:
        return;
    }
  }

  /** Decodes one received text frame; malformed frames are dropped, never thrown. */
  function receive(text: string): void {
    const result = parseServerMessage(text);
    if (!result.ok) {
      return;
    }
    reactToServerMessage(result.message);
    for (const handler of messageHandlers) {
      handler(result.message);
    }
  }

  /** Attaches this transport's frame handler to one socket (the connection never sets it). */
  function attachSocketHandlers(target: WebSocket): void {
    target.onmessage = (event: MessageEvent) => {
      if (target !== latestSocket) {
        return; // a frame that escaped a dropped socket — the current one is authoritative
      }
      const { data } = event;
      if (typeof data !== 'string') {
        return; // binary frames are not part of the catalog
      }
      receive(data);
    };
  }

  function handleConnectionStatus(status: ConnectionStatus): void {
    if (status === 'connected') {
      sendTarget = latestSocket;
      drops = 0;
      publishStatus('connected');
      return;
    }
    sendTarget = null;
    if (status === 'connecting') {
      publishStatus('connecting');
      return;
    }
    // `disconnected`: the connection schedules a bounded retry; mirror its cap for the UI.
    drops += 1;
    latestSocket = null;
    publishStatus(drops > maxAttempts ? 'exhausted' : 'disconnected');
  }

  /** Deferred join entry point: records the chosen mode and joins on the current socket. */
  function join(mode: 'guest' | 'account'): void {
    lastMode = mode;
    if (!joined && helloHandled && sendTarget !== null) {
      joined = true;
      send({ type: 'join', mode });
    }
  }

  function connect(): void {
    if (active) {
      return;
    }
    active = true;
    const created = createConnection({
      url: options.url ?? resolveWsUrl(),
      maxAttempts,
      baseDelayMs,
      maxDelayMs,
      socketFactory: (url) => {
        const socket = socketFactory(url);
        latestSocket = socket;
        helloHandled = false; // every new socket answers its own hello
         joined = false; // reset the join handshake for the new socket
        attachSocketHandlers(socket);
        return socket;
      },
      onStatus: handleConnectionStatus,
    });
    if (!active) {
      // A status subscriber closed the transport while the first attempt was starting.
      created.close();
      releaseSocket();
      return;
    }
    connection = created;
  }

  function close(): void {
    if (!active) {
      return;
    }
    active = false;
    helloHandled = false;
    joined = false;
    drops = 0;
    latestStatus = null;
    releaseSocket();
    const current = connection;
    connection = null;
    if (current !== null) {
      current.close();
    }
  }

  return {
    connect,
    close,
    send,
    join,
    onMessage(handler: (message: ServerMessage) => void): () => void {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    onStatus(handler: (status: TransportStatus) => void): () => void {
      statusHandlers.add(handler);
      if (latestStatus !== null) {
        handler(latestStatus);
      }
      return () => {
        statusHandlers.delete(handler);
      };
    },
  };
}
