/**
 * The multiplayer hub (T5): one place that owns socket attachments, identities, membership
 * broadcasts, rate limiting, the reconnect grace window and the heartbeat.
 *
 * State ownership (spec § Real-time impact, plan § Architecture): this module holds the
 * server registry (logical rooms → members → cubes), the issued identities/tokens, the move
 * plan and every connection. It is the single authority for shared values — clients only
 * send requests (`explode`, `cubeCompleted`) that are validated against the authoritative
 * board here. Nothing is persisted: a hub per process boot is the whole lifecycle (AC-4).
 *
 * Pinned rules implemented here (spec § 3, § 4, § 7, § 8, plan § Protocol):
 * - `hello` is **not** sent here: the `/ws` route sends the retained `helloMessage` and then
 *   hands the socket over (`app.ts`, plan § Interfaces line 201), so exactly one hello is the
 *   first frame (AC-20);
 * - any message before a successful join/rejoin → `error not_joined`; a second `join`/`rejoin`
 *   on a joined connection → `error bad_message` (AC-20);
 * - `explode` is validated against the member's current level, then broadcast to every member
 *   of that server **including the origin** (ack); invalid requests get `error invalid_click`
 *   + `stateSync` to the origin only (AC-14);
 * - the explode rate limit is 30 attempts per trailing second, excess dropped, and at most one
 *   `error rate_limited` per second (AC-14);
 * - `cubeCompleted` is validated against the full `6·N²` board; accepted completions draw the
 *   next cube, execute the member's planned move (re-validated), and either broadcast
 *   `levelAdvanced` (same server) or `memberLeft (moved)` / `memberJoined` / `worldEntered`
 *   (cross-server) (AC-10/AC-11/AC-15);
 * - a socket close starts `RECONNECT_GRACE_MS` of grace: the member stays in the roster and
 *   keeps its cube; expiry removes them, broadcasts `memberLeft (left)` and destroys an
 *   emptied server (AC-3/AC-7);
 * - a transport ping is sent every `WS_HEARTBEAT_INTERVAL_MS`; two unanswered pings terminate
 *   the socket; a pong resets the counter (AC-21);
 * - more than `MAX_CONNECTIONS` attached sockets → the extra socket is closed immediately.
 *
 * Time, randomness and timers are injected (`HubDeps`), so every boundary is deterministic in
 * tests: no wall-clock reads, no real sleeps.
 */

import type { GameConfig } from './config.js';
import {
  createNextCube,
  isComplete,
  styleForLevel,
  validateExplode,
  type CubeState as BoardState,
} from './cubes.js';
import {
  createGraceTracker,
  createPlayerRecord,
  type GraceTracker,
} from './players.js';
import {
  encodeServerMessage,
  errorMessage,
  levelAdvancedMessage,
  memberJoinedMessage,
  memberLeftMessage,
  miniCubeRemovedMessage,
  parseClientMessage,
  stateSyncMessage,
  welcomeMessage,
  worldEnteredMessage,
  type CubeState,
  type CubeSync,
  type ErrorCode,
  type LevelAdvance,
  type MemberState,
  type MiniCubeId,
  type Placement,
  type ServerMessage,
} from './protocol.js';
import {
  createServerRegistry,
  worldPosition,
  type ServerRegistry,
} from './servers.js';

/** The trailing window of the explode rate limit: 30 attempts per second (AC-14). */
const RATE_WINDOW_MS = 1000;

/**
 * The socket subset the hub drives.
 *
 * Production passes an adapter over the `ws` socket from `@fastify/websocket`; tests pass a
 * fake peer. Keeping the surface this small is what makes the lifecycle (join, grace,
 * heartbeat, cap) unit-testable without a real network.
 */
export interface Peer {
  /** Sends one JSON text frame. */
  send(text: string): void;
  /** Closes the connection (heartbeat termination, or the connection cap). */
  close(): void;
  /** Whether the socket can still carry frames. */
  isOpen(): boolean;
  /** Registers a transport listener: a frame, a close, or a pong. */
  on(event: 'message' | 'close' | 'pong', handler: (arg?: unknown) => void): void;
  /** Sends one WS protocol ping. */
  ping(): void;
}

/** The timer functions the hub schedules with (fake timers in tests). */
export interface HubTimers {
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

/** Injected environment: validated config, clock, RNG factory and schedulers. */
export interface HubDeps {
  config: GameConfig;
  /** Clock in milliseconds since the epoch (the hub never reads `Date.now` itself). */
  now: () => number;
  /** Returns the RNG the hub draws next-cube grids from (`N = 3 + ⌊draw·5⌋`). */
  random: () => () => number;
  timers: HubTimers;
}

/** The hub surface (`app.ts` attaches sockets; nothing else is public). */
export interface GameHub {
  /** Attaches one socket: registers the lifecycle listeners and the heartbeat. */
  attach(peer: Peer): void;
  /** Number of currently attached sockets (bounded by `config.maxConnections`). */
  connectionCount(): number;
  /** Clears every hub-owned timer and forgets the connections (app shutdown). */
  close(): void;
}

/** One attached socket and its per-connection state. */
interface Connection {
  peer: Peer;
  /** `null` until a successful join/rejoin. */
  playerId: string | null;
  /** Consecutive pings that received no pong (reset by any pong). */
  missedPongs: number;
  /** Whether the previous heartbeat tick sent a ping that is still unanswered. */
  awaitingPong: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
}

/** One member's explode quota for the current trailing window. */
interface RateWindow {
  /** Clock time the current window started. */
  start: number;
  /** Explode attempts inside the current window (valid or not). */
  count: number;
  /** When the last `rate_limited` error was sent, or `null`. */
  lastLimitedAt: number | null;
}

/** The hub's in-memory record of one member (survives a socket close during grace). */
interface Member {
  playerId: string;
  name: string;
  token: string;
  cube: BoardState;
  /** The live socket, or `null` while the member is inside the grace window. */
  connection: Connection | null;
  rate: RateWindow;
}

/**
 * Creates the hub state machine over the injected environment.
 *
 * The move plan is recomputed on the pinned membership triggers (join, socket close, grace
 * expiry, successful resume) and only read at completion, where the registry re-validates the
 * target (spec § 7) — a member can therefore never move spontaneously or twice for one trigger.
 */
export function createGameHub(deps: HubDeps): GameHub {
  const { config } = deps;
  const registry: ServerRegistry = createServerRegistry(config.maxUsersPerServer);
  const grace: GraceTracker = createGraceTracker({
    graceMs: config.reconnectGraceMs,
    now: deps.now,
  });
  const random = deps.random();
  const timers = deps.timers;

  const connections = new Set<Connection>();
  const members = new Map<string, Member>();
  const tokens = new Map<string, string>();
  const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let playerCounter = 0;
  let movePlan = new Map<string, number>();

  /** Recomputes the packing plan from the current membership (the pinned triggers). */
  function recomputePlan(): void {
    movePlan = registry.plan();
  }

  function send(connection: Connection, message: ServerMessage): void {
    if (!connection.peer.isOpen()) {
      return;
    }
    connection.peer.send(encodeServerMessage(message));
  }

  function sendError(connection: Connection, code: ErrorCode): void {
    send(connection, errorMessage(code));
  }

  function sendToPlayer(playerId: string, message: ServerMessage): void {
    const member = members.get(playerId);
    if (member?.connection) {
      send(member.connection, message);
    }
  }

  /** Sends to every member of `serverId` that still has an open socket. */
  function broadcast(serverId: number, message: ServerMessage, except?: string): void {
    const server = registry.servers().find((candidate) => candidate.id === serverId);
    if (server === undefined) {
      return;
    }
    for (const playerId of server.members) {
      if (playerId === except) {
        continue;
      }
      sendToPlayer(playerId, message);
    }
  }

  /** The member's current placement, derived from the registry (never cached). */
  function locationOf(playerId: string): { serverId: number; slot: number } | null {
    for (const server of registry.servers()) {
      const index = server.members.indexOf(playerId);
      if (index !== -1) {
        return { serverId: server.id, slot: index + 1 };
      }
    }
    return null;
  }

  function positionOf(slot: number): { x: number; y: number } {
    return worldPosition(slot, config.maxUsersPerServer);
  }

  function cubeState(member: Member): CubeState {
    return {
      levelIndex: member.cube.levelIndex,
      gridSize: member.cube.gridSize,
      styleId: member.cube.styleId,
      removedIds: [...member.cube.removedIds],
    };
  }

  function memberState(member: Member): MemberState {
    const location = locationOf(member.playerId)!;
    return {
      playerId: member.playerId,
      name: member.name,
      position: positionOf(location.slot),
      levelIndex: member.cube.levelIndex,
      gridSize: member.cube.gridSize,
      styleId: member.cube.styleId,
      removedIds: [...member.cube.removedIds],
    };
  }

  /** Every member of a server in slot order (the roster always includes the receiver). */
  function rosterFor(serverId: number): MemberState[] {
    const server = registry.servers().find((candidate) => candidate.id === serverId);
    if (server === undefined) {
      return [];
    }
    return server.members.map((playerId) => memberState(members.get(playerId)!));
  }

  function placementFor(member: Member): Placement {
    const location = locationOf(member.playerId)!;
    return {
      playerId: member.playerId,
      name: member.name,
      token: member.token,
      serverId: location.serverId,
      maxUsers: config.maxUsersPerServer,
      position: positionOf(location.slot),
      self: cubeState(member),
      roster: rosterFor(location.serverId),
    };
  }

  function sendSync(connection: Connection, member: Member): void {
    const sync: CubeSync = { playerId: member.playerId, ...cubeState(member) };
    send(connection, stateSyncMessage(sync));
  }

  /** Decodes one incoming frame; `null` for a frame shape the protocol cannot carry. */
  function frameOf(raw: unknown): { text: string; bytes: number } | null {
    if (typeof raw === 'string') {
      return { text: raw, bytes: Buffer.byteLength(raw, 'utf8') };
    }
    if (Buffer.isBuffer(raw)) {
      return { text: raw.toString('utf8'), bytes: raw.byteLength };
    }
    return null;
  }

  function clearGraceTimer(playerId: string): void {
    const handle = graceTimers.get(playerId);
    if (handle !== undefined) {
      timers.clearTimeout(handle);
      graceTimers.delete(playerId);
    }
  }

  /**
   * Schedules the grace expiry for a disconnected member.
   *
   * The deadline comes from the tracker (`now + graceMs`), so at exactly the deadline the
   * callback sees `expired === true`. A timer that fires early reschedules for the remainder
   * instead of dropping the member prematurely.
   */
  function scheduleExpiry(playerId: string): void {
    const delay = Math.max(0, grace.expiresAt(playerId) - deps.now());
    const handle = timers.setTimeout(() => {
      graceTimers.delete(playerId);
      if (!grace.expired(playerId, deps.now())) {
        scheduleExpiry(playerId);
        return;
      }
      const member = members.get(playerId);
      if (member !== undefined && member.connection === null) {
        removeMember(playerId);
      }
    }, delay);
    graceTimers.set(playerId, handle);
  }

  /** Final removal of a grace member: `memberLeft (left)`, destroy-if-empty, plan refresh. */
  function removeMember(playerId: string): void {
    const member = members.get(playerId);
    if (member === undefined) {
      return;
    }
    const location = locationOf(playerId);
    grace.cancel(playerId);
    clearGraceTimer(playerId);
    const removal = registry.removeMember(playerId);
    members.delete(playerId);
    tokens.delete(member.token);
    if (removal.left && location !== null) {
      broadcast(location.serverId, memberLeftMessage(playerId, 'left'));
    }
    recomputePlan();
  }

  function handleClose(connection: Connection): void {
    if (!connections.delete(connection)) {
      return;
    }
    if (connection.heartbeat !== null) {
      timers.clearInterval(connection.heartbeat);
      connection.heartbeat = null;
    }
    const playerId = connection.playerId;
    connection.playerId = null;
    if (playerId === null) {
      return;
    }
    const member = members.get(playerId);
    if (member === undefined || member.connection !== connection) {
      return;
    }
    member.connection = null;
    grace.begin(playerId);
    scheduleExpiry(playerId);
    recomputePlan();
  }

  /**
   * One heartbeat tick.
   *
   * A ping goes out every interval; a ping still unanswered on the next tick counts as a
   * missed pong. At the pinned limit (2) the socket is terminated — so an unresponsive peer
   * is pinged at 30 s / 60 s / 90 s and closed at the second miss (90 s). Any pong resets
   * the counter and clears the pending flag.
   */
  function heartbeat(connection: Connection): void {
    if (!connection.peer.isOpen()) {
      terminate(connection);
      return;
    }
    connection.peer.ping();
    if (connection.awaitingPong) {
      connection.missedPongs += 1;
      if (connection.missedPongs >= config.missedPongsLimit) {
        terminate(connection);
        return;
      }
    }
    connection.awaitingPong = true;
  }

  function terminate(connection: Connection): void {
    if (connection.heartbeat !== null) {
      timers.clearInterval(connection.heartbeat);
      connection.heartbeat = null;
    }
    connection.peer.close();
  }

  function memberFor(connection: Connection): Member | null {
    if (connection.playerId === null) {
      return null;
    }
    return members.get(connection.playerId) ?? null;
  }

  function handleJoin(connection: Connection): void {
    if (connection.playerId !== null) {
      sendError(connection, 'bad_message');
      return;
    }
    playerCounter += 1;
    const record = createPlayerRecord(playerCounter);
    const assignment = registry.assign(record.playerId);
    const member: Member = {
      playerId: record.playerId,
      name: record.name,
      token: record.token,
      cube: createNextCube(null, styleForLevel, random),
      connection,
      rate: { start: deps.now(), count: 0, lastLimitedAt: null },
    };
    members.set(member.playerId, member);
    tokens.set(member.token, member.playerId);
    connection.playerId = member.playerId;
    send(connection, welcomeMessage(placementFor(member)));
    broadcast(assignment.serverId, memberJoinedMessage(memberState(member)), member.playerId);
    recomputePlan();
  }

  function handleRejoin(connection: Connection, token: string): void {
    if (connection.playerId !== null) {
      sendError(connection, 'bad_message');
      return;
    }
    const playerId = tokens.get(token);
    const member = playerId === undefined ? undefined : members.get(playerId);
    // An unknown token, a token whose member already has a live socket, and an expired
    // window all fail the resume; nothing about the member changes on the unknown/live cases.
    if (member === undefined || member.connection !== null) {
      sendError(connection, 'resume_failed');
      return;
    }
    if (grace.expired(member.playerId, deps.now())) {
      // Exactly at (or past) the deadline: finalise the removal, then fail the resume.
      removeMember(member.playerId);
      sendError(connection, 'resume_failed');
      return;
    }
    grace.cancel(member.playerId);
    clearGraceTimer(member.playerId);
    member.connection = connection;
    connection.playerId = member.playerId;
    send(connection, welcomeMessage(placementFor(member)));
    recomputePlan();
  }

  function handleExplode(
    member: Member,
    connection: Connection,
    id: MiniCubeId,
    level: number,
  ): void {
    const now = deps.now();
    const rate = member.rate;
    if (now - rate.start >= RATE_WINDOW_MS) {
      rate.start = now;
      rate.count = 0;
    }
    if (rate.count >= config.clickRateLimitPerSecond) {
      if (rate.lastLimitedAt === null || now - rate.lastLimitedAt >= RATE_WINDOW_MS) {
        rate.lastLimitedAt = now;
        sendError(connection, 'rate_limited');
      }
      return;
    }
    rate.count += 1;
    if (!validateExplode(member.cube, id, level)) {
      sendError(connection, 'invalid_click');
      sendSync(connection, member);
      return;
    }
    member.cube.removedIds.add(id);
    const location = locationOf(member.playerId)!;
    broadcast(location.serverId, miniCubeRemovedMessage(member.playerId, id));
  }

  function handleCompletion(member: Member, connection: Connection, level: number): void {
    if (!isComplete(member.cube, level)) {
      sendError(connection, 'invalid_completion');
      sendSync(connection, member);
      return;
    }
    const previous = locationOf(member.playerId)!;
    const next = createNextCube(member.cube, styleForLevel, random);
    const target = movePlan.get(member.playerId);
    // The registry re-validates the target (exists, free slot, strictly lower); `null` means
    // "stay here", so the member simply advances in place.
    const moved = target === undefined ? null : registry.moveMember(member.playerId, target);
    member.cube = next;
    if (moved === null) {
      const advance: LevelAdvance = {
        playerId: member.playerId,
        levelIndex: next.levelIndex,
        gridSize: next.gridSize,
        styleId: next.styleId,
        position: positionOf(previous.slot),
      };
      broadcast(previous.serverId, levelAdvancedMessage(advance));
      return;
    }
    const location = locationOf(member.playerId)!;
    send(connection, worldEnteredMessage(placementFor(member)));
    broadcast(previous.serverId, memberLeftMessage(member.playerId, 'moved'));
    broadcast(location.serverId, memberJoinedMessage(memberState(member)), member.playerId);
  }

  function handleMessage(connection: Connection, raw: unknown): void {
    const frame = frameOf(raw);
    // Oversized frames are dropped before decoding (AC-20), even when they would parse.
    if (frame === null || frame.bytes > config.maxMessageBytes) {
      sendError(connection, 'bad_message');
      return;
    }
    const decoded = parseClientMessage(frame.text);
    if (!decoded.ok) {
      sendError(connection, 'bad_message');
      return;
    }
    const message = decoded.message;
    if (message.type === 'join') {
      handleJoin(connection);
      return;
    }
    if (message.type === 'rejoin') {
      handleRejoin(connection, message.token);
      return;
    }
    const member = memberFor(connection);
    if (member === null) {
      sendError(connection, 'not_joined');
      return;
    }
    if (message.type === 'explode') {
      handleExplode(member, connection, message.id, message.level);
      return;
    }
    handleCompletion(member, connection, message.level);
  }

  return {
    attach(peer: Peer): void {
      // Safety bound: sockets beyond the cap are closed before any state is created for them.
      if (connections.size >= config.maxConnections) {
        peer.close();
        return;
      }
      const connection: Connection = {
        peer,
        playerId: null,
        missedPongs: 0,
        awaitingPong: false,
        heartbeat: null,
      };
      connections.add(connection);
      peer.on('message', (arg) => handleMessage(connection, arg));
      peer.on('close', () => handleClose(connection));
      peer.on('pong', () => {
        connection.missedPongs = 0;
        connection.awaitingPong = false;
      });
      connection.heartbeat = timers.setInterval(
        () => heartbeat(connection),
        config.heartbeatIntervalMs,
      );
    },

    connectionCount(): number {
      return connections.size;
    },

    close(): void {
      for (const connection of connections) {
        if (connection.heartbeat !== null) {
          timers.clearInterval(connection.heartbeat);
          connection.heartbeat = null;
        }
      }
      connections.clear();
      for (const handle of graceTimers.values()) {
        timers.clearTimeout(handle);
      }
      graceTimers.clear();
    },
  };
}
