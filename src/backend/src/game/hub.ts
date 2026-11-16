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
 * - the explode rate limit is a true trailing-second window: at most 30 admitted attempts
 *   inside any 1000 ms interval, excess dropped, and at most one `error rate_limited` per
 *   trailing second (AC-14);
 * - `cubeCompleted` is validated against the full `6·N²` board; accepted completions draw the
 *   next cube, execute the member's planned move (re-validated), **re-plan the remaining
 *   donors immediately after a move** and either broadcast `levelAdvanced` (same server) or
 *   `memberLeft (moved)` / `memberJoined` / `worldEntered` (cross-server) (AC-10/AC-11/AC-15);
 * - a socket close starts `RECONNECT_GRACE_MS` of grace: the member stays in the roster and
 *   keeps its cube; expiry removes them, broadcasts `memberLeft (left)` and destroys an
 *   emptied server (AC-3/AC-7);
 * - a transport ping is sent every `WS_HEARTBEAT_INTERVAL_MS`; two unanswered pings terminate
 *   the socket; a pong resets the counter (AC-21);
 * - the connection cap is enforced before anything is sent: `hasCapacity()` lets the route
 *   close an over-cap upgrade before `hello`, and `attach` keeps the same guard as a backstop.
 *
 * Granular customization (T5, spec AC-12/AC-18…AC-22/AC-26/AC-28/AC-33):
 * - an account `openLootbox` takes a per-member `openingMembers` guard (a second open while the
 *   repository is awaiting is dropped silently and consumes no draw/state), draws exactly one
 *   weighted part with **the captured hub `random`** (F21; never a fresh `deps.random()`), and
 *   calls `applyLootboxOpenV2`; every joined connection of the account receives the absolute
 *   `customizationUpdate`, and exactly the opening connection receives `lootboxOpened`;
 * - `equipPart`/`unequipPart` are server-validated against the v2 catalog and ownership (standard
 *   parts are implicitly owned), and persist through the per-slot atomic `setSlotAppearance`;
 * - the legacy ids `body-*`/`wings-*`/`engine-*` stay accepted: the server expands them to one
 *   hull slot or both wing/ignition slots, and a multi-slot legacy id requires **both** target
 *   parts owned; nose/cockpit ids are already v2 ids and equip directly (AC-28).
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
  activityEventMessage,
  encodeServerMessage,
  errorMessage,
  levelAdvancedMessage,
  memberJoinedMessage,
  memberLeftMessage,
  miniCubeRemovedMessage,
  miniCubesRemovedMessage,
  cubeRotatedMessage,
  parseClientMessage,
  pongMessage,
  stateSyncMessage,
  economyUpdateMessage,
  upgradesUpdateMessage,
  welcomeMessage,
  worldEnteredMessage,
  leaderboardUpdateMessage,
  type CubeState,
  type CubeSync,
  type EconomyState,
  type ErrorCode,
  type Identity,
  type LevelAdvance,
  type MemberState,
  type MiniCubeId,
  type Placement,
  type ServerMessage,
  type UpgradeState,
  type CustomizationState,
  type LeaderboardSnapshot,
  customizationUpdateMessage,
  lootboxOpenedMessage,
} from './protocol.js';
import {
  createServerRegistry,
  worldPosition,
  type ServerRegistry,
} from './servers.js';
import {
  createEconomyCoalescer,
  createRemovalBatcher,
} from './broadcast.js';
import {
  buildLeaderboardSnapshot,
  createLeaderboardCoalescer,
  LEADERBOARD_INTERVAL_MS,
  type LeaderboardMember,
} from './leaderboard.js';
import {
  ACTIVITY_MILESTONE_EVERY,
  createActivityFeed,
  type ActivityEventInput,
} from './activity.js';
import type {
  EconomyRepository,
  EconomySnapshot,
} from '../auth/economy-repository.js';
import {
  COINS_PER_CUBE,
  COINS_PER_MINI_CUBE,
  roundCoins,
  thresholdSeconds,
  idleCoins,
} from './economy.js';
import {
  miniCubeMultiplier,
  cubeMultiplier,
  speedWindowSeconds,
  isValidUpgradeId,
  upgradeLevel,
  upgradeCost,
  UPGRADE_CATALOG,
} from './upgrades.js';
import {
  defaultPartForSlot,
  isValidPartId,
  isValidSlotId,
  partDefinition,
  selectLootPart,
  type PartIdV2,
  type SlotId,
} from './parts-v2.js';
import type { LogSink } from '../observability/logging.js';
import type { Metrics } from '../observability/metrics.js';

/** The trailing window of the explode rate limit: 30 admitted attempts per second (AC-14). */
const RATE_WINDOW_MS = 1000;

/**
 * Diagnostic ping limit: at most one accepted `ping` per connection per second (AC-23).
 * The bound makes pong replies connection-local, small and non-amplifying.
 */
export const PING_RATE_LIMIT_MS = 1000;

/**
 * Log value used when a direct hub `attach` has no Fastify request id (tests/benchmarks).
 * Production always passes `req.id`; the constant keeps the `connectionId` field present.
 */
const UNKNOWN_CONNECTION_ID = 'unknown';

/** Removal coalescing window: at most one removal frame per member per window (AC-8/AC-14). */
export const MINI_CUBE_BATCH_WINDOW_MS = 40;

/** Automatic economy broadcast cadence: at most 4 Hz per account (AC-19/AC-20). */
export const ECONOMY_BROADCAST_INTERVAL_MS = 250;

/** Max `rotate` messages per trailing second per member (AC-6). */
const ROTATE_RATE_LIMIT = 20;

/** One equip target: the v2 slot and the v2 part to place there. */
interface EquipTarget {
  slot: SlotId;
  partId: PartIdV2;
}

/**
 * Legacy catalog part ids expanded server-side to their v2 target(s) (AC-28):
 * `body-*` → one hull slot, `wings-*` → both wing slots, `engine-*` → both ignition slots.
 * Nose/cockpit ids are v2 ids already and resolve through `isValidPartId`.
 */
const LEGACY_EQUIP_TARGETS: Readonly<Record<string, readonly PartIdV2[]>> = {
  'body-default': ['hull-default'],
  'body-obsidian': ['hull-obsidian'],
  'body-gold': ['hull-gold'],
  'wings-default': ['wing-left-default', 'wing-right-default'],
  'wings-silver': ['wing-left-silver', 'wing-right-silver'],
  'engine-default': ['ignition-left-default', 'ignition-right-default'],
  'engine-blue': ['ignition-left-blue', 'ignition-right-blue'],
};

/** Expands a client-supplied part id to its v2 target slot(s); `null` when unknown. */
function resolveEquipTargets(partId: string): EquipTarget[] | null {
  if (isValidPartId(partId)) {
    return [{ slot: partDefinition(partId).slot, partId }];
  }
  const legacy = LEGACY_EQUIP_TARGETS[partId];
  if (legacy === undefined) {
    return null;
  }
  return legacy.map((id) => ({ slot: partDefinition(id).slot, partId: id }));
}

/** Standard parts are implicitly owned (AC-12); other parts need a positive count (AC-21). */
function ownsPart(state: CustomizationState, partId: PartIdV2): boolean {
  return partDefinition(partId).rarity === 'standard' || (state.parts[partId] ?? 0) > 0;
}

/**
 * Positive part counts for the `lootboxOpened` payload: the AC-24 codec requires positive
 * integers, so zero-count entries (semantically absent) are not put on the wire.
 */
function positivePartCounts(parts: Record<string, number>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [id, count] of Object.entries(parts)) {
    if (Number.isInteger(count) && count > 0) {
      counts[id] = count;
    }
  }
  return counts;
}

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
  /** Optional economy repository; absent => no persistence (guests / tests). */
  economy?: EconomyRepository | null;
  /**
   * Test/benchmark seam: a registry matching `config.maxUsersPerServer`. Production omits
   * it and the hub creates its own; the injected registry is used unchanged (the hub only
   * calls its `assign`/`removeMember`/`moveMember`/`plan`/`locationOf`/`forEachMember`).
   */
  registry?: ServerRegistry;
  /**
   * Optional in-process metrics registry. Absent => every increment/gauge/observation is a
   * no-op, so the hub keeps working in benchmarks, scripts and existing tests.
   */
  metrics?: Metrics;
  /**
   * Optional event-first log sink (`info(event, fields)`). Never pass a raw `app.log`:
   * `createLogSink` adapts Pino's object-first API. Absent => no lifecycle logs.
   */
  log?: LogSink;
}

/** Account session resolved from the upgrade cookie (server-authoritative). */
export interface AccountSession {
  userId: string;
  username: string;
  verified: boolean;
}

/** The hub surface (`app.ts` attaches sockets; nothing else is public). */
export interface GameHub {
  /**
   * Whether one more socket may attach (`connectionCount() < MAX_CONNECTIONS`).
   *
   * The `/ws` route checks this **before** sending `hello`, so an over-cap upgrade is closed
   * without ever starting the protocol (AC-20, F5).
   */
  hasCapacity(): boolean;
  /**
   * Attaches one socket: registers the lifecycle listeners and the heartbeat.
   *
   * `connectionId` is the Fastify request id (`req.id`) used for log correlation; a direct
   * attach omits it and the lifecycle logs use the constant `unknown` placeholder.
   */
  attach(peer: Peer, accountSession?: AccountSession | null, connectionId?: string): void;
  /** Number of currently attached sockets (bounded by `config.maxConnections`). */
  connectionCount(): number;
  /** Clears every hub-owned timer and forgets the connections (app shutdown). */
  close(): void;
  /**
   * Test-only observability: the number of entries in the two revision guards.
   * Has no production caller (AC-29/AC-30).
   */
  revisionStateForTesting(): { economyRevisions: number; upgradeRevisions: number };
}

/** Why a connection left the hub; the closed counter label uses the same values. */
type CloseReason = 'client' | 'heartbeat' | 'error' | 'server';

/** One attached socket and its per-connection state. */
interface Connection {
  peer: Peer;
  /** Resolved from the upgrade cookie; never from client input. */
  accountSession: AccountSession | null;
  /** Fastify request id used for log correlation (or `null` for a direct attach). */
  connectionId: string | null;
  /** `null` until a successful join/rejoin. */
  playerId: string | null;
  /** Consecutive pings that received no pong (reset by any pong). */
  missedPongs: number;
  /** Whether the previous heartbeat tick sent a ping that is still unanswered. */
  awaitingPong: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
  /** Whether a join/rejoin ever succeeded on this socket (close-log field). */
  wasJoined: boolean;
  /** Hub clock at attach, for the connection-duration histogram. */
  attachedAtMs: number;
  /** Defaults to `client`; set by the path that terminates the socket. */
  closeReason: CloseReason;
  /** Hub clock of the last accepted diagnostic ping, or `null`. */
  lastPingAtMs: number | null;
}

/** One member's explode quota for the trailing second. */
interface RateWindow {
  /** Timestamps (ms) of the attempts admitted inside the current trailing window. */
  admitted: number[];
  /** When the last `rate_limited` error was sent, or `null`. */
  lastLimitedAt: number | null;
}

/** The hub's in-memory record of one member (survives a socket close during grace). */
interface Member {
  playerId: string;
  name: string;
  accountId: string | null;
  token: string;
  cube: BoardState;
  yawSteps: number;
  pitchSteps: number;
  /** Server timestamp (ms) when this cube started, for the speed bonus. */
  cubeStartedAtMs: number;
  /** Server-authoritative economy totals for this member. */
  economy: EconomyState;
  /** Server-authoritative upgrade levels for this member. */
  upgrades: UpgradeState;
  /** Server-authoritative customization state for this member. */
  customization: CustomizationState;
  /**
   * Session counters for the live leaderboard (`server-live-leaderboard`).
   *
   * Incremented only at the hub's accepted transitions (`handleExplode` after validation,
   * `handleCompletion` after `isComplete`); never read from or written to the account
   * economy, and deleted with the member. Coins are deliberately absent.
   */
  sessionStats: {
    clicks: number;
    facesDestroyed: number;
    cubesCompleted: number;
  };
  /** The live socket, or `null` while the member is inside the grace window. */
  connection: Connection | null;
  rate: RateWindow;
  rotateRate: RateWindow;
}

/**
 * Creates the hub state machine over the injected environment.
 *
 * The move plan is recomputed on the pinned membership triggers (join, socket close, grace
 * expiry, successful resume) **and after every executed move** (F3), and only read at
 * completion, where the registry re-validates the target (spec § 7) — a member can therefore
 * never move spontaneously or twice for one trigger.
 */
export function createGameHub(deps: HubDeps): GameHub {
  const { config } = deps;
  const economyRepo = deps.economy ?? null;
  const registry: ServerRegistry =
    deps.registry ?? createServerRegistry(config.maxUsersPerServer);
  const grace: GraceTracker = createGraceTracker({
    graceMs: config.reconnectGraceMs,
    now: deps.now,
  });
  /**
   * The one captured RNG stream (F21/AC-18). Every server draw shares it, synchronously in
   * message-arrival order: a join and each accepted cube completion draw one next-cube grid
   * value (`createNextCube`), and every account `openLootbox` that passes the in-flight guard
   * draws exactly one weighted loot value (`selectLootPart`) before its repository await. An
   * in-flight guard drop therefore never consumes a loot draw, and no handler ever calls
   * `deps.random()` again.
   */
  const random = deps.random();
  const timers = deps.timers;
  const metrics = deps.metrics ?? null;
  const log = deps.log ?? null;

  const connections = new Set<Connection>();
  const members = new Map<string, Member>();
  const tokens = new Map<string, string>();
  const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Member ids with an `openLootbox` awaiting the repository (per-member in-flight guard). */
  const openingMembers = new Set<string>();
  /** The one per-server activity feed (feature `live-activity-feed`); timered by nothing. */
  const activity = createActivityFeed({ now: deps.now });
  let playerCounter = 0;
  let movePlan = new Map<string, number>();

  /** Set first in `close()`; makes late frames, late continuations and sends inert (AC-30). */
  let closed = false;
  /** Per-account last applied economy write revision (`applyEconomySnapshot`, AC-29). */
  const economyRevisions = new Map<string, number>();
  /** Per-account last applied purchase revision (`applyUpgradeSnapshot`, AC-29). */
  const upgradeRevisions = new Map<string, number>();

  /** The `connectionId` log field (production passes `req.id`; direct attaches are `unknown`). */
  function connectionIdOf(connection: Connection): string {
    return connection.connectionId ?? UNKNOWN_CONNECTION_ID;
  }

  /** Connection lifetime in milliseconds from the injected clock, never negative. */
  function connectionDurationMs(connection: Connection): number {
    return Math.max(0, deps.now() - connection.attachedAtMs);
  }

  /** Connection lifetime in seconds (the histogram unit). */
  function connectionDurationSeconds(connection: Connection): number {
    return connectionDurationMs(connection) / 1000;
  }

  /** Open/capacity gauges, refreshed after an attach or close. */
  function refreshConnectionGauges(): void {
    if (metrics === null) {
      return;
    }
    metrics.set('cubeclicker_ws_connections_open', connections.size);
    metrics.set('cubeclicker_ws_connections_capacity', config.maxConnections);
  }

  /** Room/member/capacity gauges, refreshed after every membership change and on close. */
  function refreshRoomGauges(): void {
    if (metrics === null) {
      return;
    }
    metrics.set('cubeclicker_servers_active', registry.serverCount());
    metrics.set('cubeclicker_members_active', members.size);
    metrics.set('cubeclicker_server_capacity', config.maxUsersPerServer);
  }

  // The configured capacities are constant, so they are published once even before the
  // first attach; the live gauges above take over from the first membership event.
  refreshConnectionGauges();
  refreshRoomGauges();

  /**
   * Coalesces accepted removals into one 40 ms window. The callback builds the legacy
   * single-id frame or the batched frame and broadcasts it once per group (AC-8/AC-9).
   */
  const removalBatcher = createRemovalBatcher({
    windowMs: MINI_CUBE_BATCH_WINDOW_MS,
    timers,
    flush(groups): void {
      let flushedIds = 0;
      for (const group of groups) {
        flushedIds += group.ids.length;
        metrics?.observe('cubeclicker_removal_batch_size', group.ids.length);
        const message =
          group.ids.length === 1
            ? miniCubeRemovedMessage(group.playerId, group.ids[0]!)
            : miniCubesRemovedMessage(group.playerId, group.ids);
        broadcast(group.serverId, message);
      }
      metrics?.inc('cubeclicker_removal_flushes_total');
      metrics?.inc('cubeclicker_removal_ids_total', undefined, flushedIds);
      // The batcher clears its pending groups before invoking this callback.
      metrics?.set('cubeclicker_removal_batch_pending_groups', removalBatcher.pendingGroups());
    },
  });

  /**
   * Coalesces automatic economy frames per account to one 250 ms cadence. The flush is
   * encode-free when no joined connection of the account remains (AC-22).
   */
  const economyCoalescer = createEconomyCoalescer({
    intervalMs: ECONOMY_BROADCAST_INTERVAL_MS,
    timers,
    flush(userId, _revision, economy): void {
      broadcastEconomyUpdate(userId, economy);
      metrics?.inc('cubeclicker_economy_flushes_total');
      // The coalescer deletes the account's pending entry before invoking this callback.
      metrics?.set('cubeclicker_economy_pending_accounts', economyCoalescer.pendingAccounts());
    },
  });

  /**
   * Coalesces leaderboard snapshots per dirty server to one 1 s cadence
   * (`server-live-leaderboard`). The flush builds the snapshot then, from the server's live
   * members, and publishes one encode-once `leaderboardUpdate` (no `except`: the ranking is a
   * server-wide view, so the origin is included too).
   */
  const leaderboard = createLeaderboardCoalescer({
    intervalMs: LEADERBOARD_INTERVAL_MS,
    timers,
    flush(serverId): void {
      publishLeaderboard(serverId);
    },
  });

  /** Boundary flush: pending removals go out before the next level/membership message. */
  function flushRemovalBatches(): void {
    removalBatcher.flush();
  }

  /** Recomputes the packing plan from the current membership (the pinned triggers). */
  function recomputePlan(): void {
    movePlan = registry.plan();
  }

  /**
   * Delivers one pre-encoded frame to one connection.
   *
   * The `isOpen` guard is kept, and a synchronous `send` throw is isolated: only that peer
   * is terminated (through the normal close path), so a failed send can neither abort a
   * fan-out nor leak a connection (AC-2). Returns whether the frame reached the peer; the
   * frame-sent counter and the broadcast fan-out observe only successful deliveries.
   */
  function deliver(connection: Connection, text: string, type: ServerMessage['type']): boolean {
    if (closed) {
      return false;
    }
    const peer = connection.peer;
    if (!peer.isOpen()) {
      return false;
    }
    try {
      peer.send(text);
    } catch {
      // A failed send terminates this peer with the pinned `error` close reason.
      terminate(connection, 'error');
      return false;
    }
    metrics?.inc('cubeclicker_ws_frames_sent_total', { type });
    return true;
  }

  /** Encodes once and sends to one connection. */
  function send(connection: Connection, message: ServerMessage): void {
    if (closed) {
      return;
    }
    const text = encodeServerMessage(message);
    metrics?.inc('cubeclicker_ws_messages_encoded_total', { type: message.type });
    deliver(connection, text, message.type);
  }

  function sendError(connection: Connection, code: ErrorCode): void {
    send(connection, errorMessage(code));
  }

  /**
   * Broadcasts to every member of `serverId` with an open socket (holes skipped).
   *
   * The message is encoded exactly once and the same text is fanned out through the
   * registry's slot-table visitor; call order is per-server delivery order (AC-1).
   */
  function broadcast(serverId: number, message: ServerMessage, except?: string): void {
    if (closed) {
      return;
    }
    const text = encodeServerMessage(message);
    metrics?.inc('cubeclicker_ws_messages_encoded_total', { type: message.type });
    let recipients = 0;
    registry.forEachMember(serverId, (playerId) => {
      if (playerId === except) {
        return;
      }
      const connection = members.get(playerId)?.connection;
      if (connection && deliver(connection, text, message.type)) {
        recipients += 1;
      }
    });
    metrics?.inc('cubeclicker_ws_broadcasts_total');
    metrics?.observe('cubeclicker_ws_broadcast_fanout', recipients);
  }

  /**
   * Broadcasts one message to every joined connection of an account.
   *
   * The recipient list is collected first: with no joined connection the function returns
   * before encoding, so a coalesced flush after every tab left sends and encodes nothing
   * (AC-22). Otherwise the message is encoded once for all recipients (AC-3).
   */
  function broadcastAccount(userId: string, message: ServerMessage): void {
    if (closed) {
      return;
    }
    const targets: Connection[] = [];
    for (const connection of connections) {
      if (connection.playerId === null) {
        continue;
      }
      if (connection.accountSession?.userId !== userId) {
        continue;
      }
      if (!connection.peer.isOpen()) {
        continue;
      }
      targets.push(connection);
    }
    if (targets.length === 0) {
      return;
    }
    const text = encodeServerMessage(message);
    metrics?.inc('cubeclicker_ws_messages_encoded_total', { type: message.type });
    for (const connection of targets) {
      deliver(connection, text, message.type);
    }
  }

  /**
   * Offers one validated-transition candidate to the per-server feed.
   *
   * The feed assigns `id`/`at`/`serverId` and applies the 1/s gate; only an accepted candidate
   * is broadcast, through the same encode-once fan-out as every other server message (the
   * frame is serialized once for all recipients). `except` is used only for the fresh-join
   * frame (`memberJoined`), which excludes the joining member but stays in the ring (AC-5).
   */
  function recordActivity(
    serverId: number,
    input: ActivityEventInput,
    except?: string,
  ): void {
    if (closed) {
      return;
    }
    const event = activity.record(serverId, input);
    if (event === null) {
      return;
    }
    broadcast(serverId, activityEventMessage(event), except);
  }

  /**
   * Whether a server still has at least one member after a move (the old-server `memberLeft`
   * candidate probe). `registry.forEachMember` visits nothing for an unknown/destroyed server,
   * so this needs no registry interface change (AC-7).
   */
  function serverHasMembers(serverId: number): boolean {
    let hasMembers = false;
    registry.forEachMember(serverId, () => {
      hasMembers = true;
    });
    return hasMembers;
  }

  /**
   * The member's current placement from the registry's O(1) index (never cached).
   *
   * The visitor/index is the registry's derived view of the slot table, so a vacated slot
   * next to the member leaves their slot unchanged.
   */
  function locationOf(playerId: string): { serverId: number; slot: number } | null {
    return registry.locationOf(playerId);
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
      yawSteps: member.yawSteps,
      pitchSteps: member.pitchSteps,
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
      yawSteps: member.yawSteps,
      pitchSteps: member.pitchSteps,
    };
  }

  /** Every member of a server in slot order (holes skipped; the roster always includes the receiver). */
  function rosterFor(serverId: number): MemberState[] {
    const roster: MemberState[] = [];
    registry.forEachMember(serverId, (playerId) => {
      const member = members.get(playerId);
      if (member !== undefined) {
        roster.push(memberState(member));
      }
    });
    return roster;
  }

  /**
   * The server's members for the leaderboard builder, in registry/slot order.
   *
   * Only server-issued identity and session counters are exposed; the missing-member check is
   * defensive (the registry and `members` are kept in sync by every membership transition).
   */
  function collectLeaderboardMembers(serverId: number): LeaderboardMember[] {
    const collected: LeaderboardMember[] = [];
    registry.forEachMember(serverId, (playerId) => {
      const member = members.get(playerId);
      if (member === undefined) {
        return;
      }
      collected.push({
        playerId: member.playerId,
        name: member.name,
        clicks: member.sessionStats.clicks,
        facesDestroyed: member.sessionStats.facesDestroyed,
        cubesCompleted: member.sessionStats.cubesCompleted,
      });
    });
    return collected;
  }

  /** The server's current ranked snapshot, built at this exact call (never cached). */
  function snapshotFor(serverId: number): LeaderboardSnapshot {
    return buildLeaderboardSnapshot(
      serverId,
      deps.now(),
      collectLeaderboardMembers(serverId),
    );
  }

  /**
   * The coalescer flush: one encoded `leaderboardUpdate` per dirty server.
   *
   * A closed hub sends nothing, and a server that lost its last member while the timer was
   * pending is skipped (its timer is dropped on destruction anyway; this is the backstop).
   */
  function publishLeaderboard(serverId: number): void {
    if (closed || !serverHasMembers(serverId)) {
      return;
    }
    broadcast(serverId, leaderboardUpdateMessage(snapshotFor(serverId)));
  }

  function placementFor(member: Member): Placement {
    const location = locationOf(member.playerId)!;
    const identity: Identity =
      member.accountId !== null
        ? { kind: 'account', accountId: member.accountId, username: member.name }
        : { kind: 'guest', playerId: member.playerId };
    return {
      playerId: member.playerId,
      name: member.name,
      token: member.token,
      serverId: location.serverId,
      maxUsers: config.maxUsersPerServer,
      position: positionOf(location.slot),
      self: cubeState(member),
      roster: rosterFor(location.serverId),
      activity: activity.snapshot(location.serverId),
      leaderboard: snapshotFor(location.serverId),
      identity,
      economy: member.economy,
      ...(member.accountId !== null
        ? { upgrades: member.upgrades, customization: member.customization }
        : {}),
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
    if (closed) {
      return;
    }
    const member = members.get(playerId);
    if (member === undefined) {
      return;
    }
    const location = locationOf(playerId);
    grace.cancel(playerId);
    clearGraceTimer(playerId);
    // Boundary: the member's own pending removals reach the server before `memberLeft`.
    flushRemovalBatches();
    const removal = registry.removeMember(playerId);
    members.delete(playerId);
    tokens.delete(member.token);
    if (removal.left && location !== null) {
      broadcast(location.serverId, memberLeftMessage(playerId, 'left'));
      // A destroyed server keeps no feed: its buffer is deleted with the room (AC-6/AC-11).
      if (removal.serverDestroyed) {
        activity.dropServer(location.serverId);
        leaderboard.dropServer(location.serverId);
      } else {
        recordActivity(location.serverId, {
          type: 'memberLeft',
          playerId,
          name: member.name,
        });
        leaderboard.markDirty(location.serverId);
      }
    }
    recomputePlan();
    refreshRoomGauges();
  }

  function handleClose(connection: Connection): void {
    if (!connections.delete(connection)) {
      return;
    }
    if (connection.heartbeat !== null) {
      timers.clearInterval(connection.heartbeat);
      connection.heartbeat = null;
    }
    refreshConnectionGauges();
    refreshRoomGauges();
    metrics?.inc('cubeclicker_ws_connections_closed_total', { reason: connection.closeReason });
    metrics?.observe('cubeclicker_ws_connection_duration_seconds', connectionDurationSeconds(connection));
    log?.info('ws_connection_closed', {
      connectionId: connectionIdOf(connection),
      reason: connection.closeReason,
      durationMs: connectionDurationMs(connection),
      wasJoined: connection.wasJoined,
    });
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
    // Touch last_seen_at on the final active connection for an account (unconditional).
    if (member.accountId !== null && economyRepo !== null) {
      const accountId = member.accountId;
      let hasOtherActive = false;
      for (const m of members.values()) {
        if (m.accountId === accountId && m !== member && m.connection !== null) {
          hasOtherActive = true;
          break;
        }
      }
      if (!hasOtherActive) {
        void economyRepo.touchLastSeen(accountId, deps.now());
      }
    }
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
      terminate(connection, 'heartbeat');
      return;
    }
    connection.peer.ping();
    if (connection.awaitingPong) {
      connection.missedPongs += 1;
      if (connection.missedPongs >= config.missedPongsLimit) {
        metrics?.inc('cubeclicker_ws_heartbeat_timeouts_total');
        log?.warn('ws_heartbeat_timeout', {
          connectionId: connectionIdOf(connection),
          wasJoined: connection.wasJoined,
        });
        terminate(connection, 'heartbeat');
        return;
      }
    }
    connection.awaitingPong = true;
  }

  function terminate(connection: Connection, reason: 'heartbeat' | 'error'): void {
    connection.closeReason = reason;
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

  async function handleJoin(connection: Connection, mode?: 'account' | 'guest'): Promise<void> {
    if (connection.playerId !== null) {
      sendError(connection, 'bad_message');
      return;
    }
    const effectiveMode: 'account' | 'guest' =
      mode ??
      (connection.accountSession !== null && connection.accountSession.verified
        ? 'account'
        : 'guest');

    if (effectiveMode === 'account') {
      if (connection.accountSession === null) {
        sendError(connection, 'not_authenticated');
        return;
      }
      if (!connection.accountSession.verified) {
        sendError(connection, 'account_unverified');
        return;
      }
    }

    const isAccount = effectiveMode === 'account';
    const accountId = isAccount ? connection.accountSession!.userId : null;

    // Load persisted economy before creating the member (account + repo present). Both
    // revision guards are seeded from one read each, so an in-flight older result can never
    // beat the persisted baseline (AC-29).
    let loadedEconomy: EconomyState = { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 };
    let loadedUpgrades: UpgradeState = {};
    let loadedCustomization: CustomizationState = { lootboxes: 0, keys: 0, parts: {}, appearance: {} };
    let loadedEconomyRevision = 0;
    let loadedUpgradesRevision = 0;
    let idleSnapshot: EconomySnapshot | null = null;
    if (isAccount && accountId !== null && economyRepo !== null) {
      const economySnapshot = await economyRepo.findEconomySnapshot(accountId);
      if (closed) {
        return;
      }
      const knownEconomyRevision = economyRevisions.get(accountId) ?? 0;
      if (economySnapshot !== null && economySnapshot.revision >= knownEconomyRevision) {
        loadedEconomy = economySnapshot.economy;
        loadedEconomyRevision = economySnapshot.revision;
        economyRevisions.set(accountId, economySnapshot.revision);
      } else {
        loadedEconomy = economyOfAccountMember(accountId)
          ?? economySnapshot?.economy
          ?? loadedEconomy;
        loadedEconomyRevision = knownEconomyRevision;
      }

      const upgradesSnapshot = await economyRepo.findUpgradesSnapshot(accountId);
      if (closed) {
        return;
      }
      const knownUpgradeRevision = upgradeRevisions.get(accountId) ?? 0;
      if (upgradesSnapshot.revision >= knownUpgradeRevision) {
        loadedUpgrades = upgradesSnapshot.upgrades;
        loadedUpgradesRevision = upgradesSnapshot.revision;
        upgradeRevisions.set(accountId, upgradesSnapshot.revision);
      } else {
        loadedUpgrades = upgradesOfAccountMember(accountId) ?? upgradesSnapshot.upgrades;
        loadedUpgradesRevision = knownUpgradeRevision;
      }

      loadedCustomization = await economyRepo.findCustomizationByUserId(accountId);
      if (closed) {
        return;
      }
      const lastSeenAt = await economyRepo.findLastSeenAt(accountId);
      if (closed) {
        return;
      }
      const now = deps.now();
      const touched = await economyRepo.touchLastSeen(accountId, now, lastSeenAt);
      if (closed) {
        return;
      }
      if (touched) {
        const elapsed = lastSeenAt === null ? 0 : now - lastSeenAt;
        const coins = idleCoins(elapsed, loadedUpgrades);
        if (coins > 0) {
          const snapshot = await economyRepo.creditWithRevision(accountId, { coins });
          if (closed) {
            return;
          }
          loadedEconomy = snapshot.economy;
          loadedEconomyRevision = Math.max(loadedEconomyRevision, snapshot.revision);
          // Accepted idle credit is flushed immediately after the member exists (the
          // joining connection is then included, as before), never on the automatic window.
          if (applyEconomySnapshot(accountId, snapshot)) {
            idleSnapshot = snapshot;
          } else {
            loadedEconomy = economyOfAccountMember(accountId) ?? loadedEconomy;
            loadedEconomyRevision = economyRevisions.get(accountId) ?? loadedEconomyRevision;
          }
        }
      }

      // An async write may have applied a newer revision while this join awaited: the
      // joining member starts from that account's in-memory state (the read is fallback).
      const appliedEconomyRevision = economyRevisions.get(accountId) ?? 0;
      if (appliedEconomyRevision > loadedEconomyRevision) {
        loadedEconomy = economyOfAccountMember(accountId) ?? loadedEconomy;
        loadedEconomyRevision = appliedEconomyRevision;
      }
      const appliedUpgradeRevision = upgradeRevisions.get(accountId) ?? 0;
      if (appliedUpgradeRevision > loadedUpgradesRevision) {
        loadedUpgrades = upgradesOfAccountMember(accountId) ?? loadedUpgrades;
        loadedUpgradesRevision = appliedUpgradeRevision;
      }
    }

    // Boundary: pending removals for the server reach existing members before this join's
    // `welcome`/`memberJoined` (AC-11).
    flushRemovalBatches();

    playerCounter += 1;
    const record = createPlayerRecord(playerCounter);
    const assignment = registry.assign(record.playerId);
    const name = isAccount ? connection.accountSession!.username : record.name;
    const member: Member = {
      playerId: record.playerId,
      name,
      accountId,
      token: record.token,
      cube: createNextCube(null, styleForLevel, random),
      yawSteps: 0,
      pitchSteps: 0,
      cubeStartedAtMs: deps.now(),
      economy: loadedEconomy,
      upgrades: loadedUpgrades,
      customization: loadedCustomization,
      sessionStats: { clicks: 0, facesDestroyed: 0, cubesCompleted: 0 },
      connection,
      rate: { admitted: [], lastLimitedAt: null },
      rotateRate: { admitted: [], lastLimitedAt: null },
    };
    members.set(member.playerId, member);
    tokens.set(member.token, member.playerId);
    connection.playerId = member.playerId;
    connection.wasJoined = true;
    // Join-time idle credit keeps today's immediate pre-`welcome` economyUpdate (AC-21);
    // the forced flush also cancels that account's automatic window.
    if (accountId !== null && idleSnapshot !== null) {
      queueEconomy(accountId, idleSnapshot);
      economyCoalescer.flush(accountId);
    }
    send(connection, welcomeMessage(placementFor(member)));
    broadcast(assignment.serverId, memberJoinedMessage(memberState(member)), member.playerId);
    // The fresh-join candidate excludes the joiner from the live frame but stays in the ring
    // for later joiners/reconnects (AC-5). A move-in join records no activity (AC-7).
    recordActivity(
      assignment.serverId,
      { type: 'memberJoined', playerId: member.playerId, name: member.name },
      member.playerId,
    );
    recomputePlan();
    refreshRoomGauges();
    // A fresh join is a membership change: the joiner appears with zero counters in the next
    // coalesced snapshot (their `welcome` already carries the immediate one).
    leaderboard.markDirty(assignment.serverId);
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
    // Account resume validation: an authenticated connection may only resume a member
    // whose accountId matches the cookie's userId (and the session is verified); an
    // unauthenticated connection may only resume a guest member.
    if (connection.accountSession !== null) {
      if (!connection.accountSession.verified) {
        sendError(connection, 'resume_failed');
        return;
      }
      if (member.accountId !== connection.accountSession.userId) {
        sendError(connection, 'resume_failed');
        return;
      }
    } else {
      if (member.accountId !== null) {
        sendError(connection, 'resume_failed');
        return;
      }
    }
    if (grace.expired(member.playerId, deps.now())) {
      // Exactly at (or past) the deadline: finalise the removal, then fail the resume.
      removeMember(member.playerId);
      sendError(connection, 'resume_failed');
      return;
    }
    // Boundary: pending removals go out before this resume's authoritative `welcome`.
    flushRemovalBatches();
    grace.cancel(member.playerId);
    clearGraceTimer(member.playerId);
    member.connection = connection;
    connection.playerId = member.playerId;
    connection.wasJoined = true;
    send(connection, welcomeMessage(placementFor(member)));
    recomputePlan();
    refreshRoomGauges();
  }

  function handleExplode(
    member: Member,
    connection: Connection,
    id: MiniCubeId,
    level: number,
  ): void {
    const now = deps.now();
    const rate = member.rate;
    // True trailing-second window: forget every admitted attempt that is now at or before
    // `now − 1000 ms`, so at most 30 attempts can sit inside any 1000 ms interval (F4).
    while (rate.admitted.length > 0 && rate.admitted[0]! <= now - RATE_WINDOW_MS) {
      rate.admitted.shift();
    }
    if (rate.admitted.length >= config.clickRateLimitPerSecond) {
      // Every dropped exploded frame counts, even when the rate-limit error is throttled.
      metrics?.inc('cubeclicker_rate_limit_drops_total', { scope: 'explode' });
      if (rate.lastLimitedAt === null || now - rate.lastLimitedAt >= RATE_WINDOW_MS) {
        rate.lastLimitedAt = now;
        sendError(connection, 'rate_limited');
      }
      return;
    }
    rate.admitted.push(now);
    if (!validateExplode(member.cube, id, level)) {
      sendError(connection, 'invalid_click');
      sendSync(connection, member);
      return;
    }
    member.cube.removedIds.add(id);
    // Accepted-click counter: only the validated path above reaches this line, so invalid,
    // rate-limited, oversized and pre-join attempts never increment (AC-1).
    member.sessionStats.clicks += 1;
    const location = locationOf(member.playerId)!;
    // Authority first: the removed id is recorded synchronously above; only the
    // notification is coalesced into the 40 ms window (AC-8/AC-9).
    removalBatcher.enqueue(location.serverId, member.playerId, id);
    metrics?.set('cubeclicker_removal_batch_pending_groups', removalBatcher.pendingGroups());

    // Face-clear detection: all N² ids of that face now removed.
    const face = id.split(':')[0] as string;
    const gridSize = member.cube.gridSize;
    let faceCleared = true;
    for (let r = 0; r < gridSize && faceCleared; r += 1) {
      for (let c = 0; c < gridSize; c += 1) {
        if (!member.cube.removedIds.has(`${face}:${r}:${c}`)) {
          faceCleared = false;
          break;
        }
      }
    }
    if (faceCleared) {
      member.sessionStats.facesDestroyed += 1;
    }
    // Any accepted click is a counter change for this server's coalesced snapshot (AC-9).
    leaderboard.markDirty(location.serverId);

    // Account credit (fire-and-forget): mini-cube coins + click + face (if cleared).
    if (member.accountId !== null && economyRepo !== null) {
      const accountId = member.accountId;
      const delta = {
        coins: roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(member.upgrades)),
        clicks: 1,
        facesDestroyed: faceCleared ? 1 : 0,
      };
      void economyRepo.creditWithRevision(accountId, delta).then((snapshot) => {
        if (closed) {
          return;
        }
        if (applyEconomySnapshot(accountId, snapshot)) {
          queueEconomy(accountId, snapshot);
        }
      });
    }
  }

  /** One account member's current economy (the join fallback when its read is older). */
  function economyOfAccountMember(accountId: string): EconomyState | null {
    for (const m of members.values()) {
      if (m.accountId === accountId) {
        return m.economy;
      }
    }
    return null;
  }

  /** One account member's current upgrades (the join fallback when its read is older). */
  function upgradesOfAccountMember(accountId: string): UpgradeState | null {
    for (const m of members.values()) {
      if (m.accountId === accountId) {
        return m.upgrades;
      }
    }
    return null;
  }

  /**
   * Applies an absolute economy snapshot only when its write revision is newer.
   *
   * The returned boolean tells the caller whether the update was accepted, so an older
   * async result can never overwrite newer totals nor be queued (AC-29).
   */
  function applyEconomySnapshot(accountId: string, snapshot: EconomySnapshot): boolean {
    if (closed) {
      // A result rejected only because the hub is closed is not a stale rejection (AC-15).
      return false;
    }
    const last = economyRevisions.get(accountId) ?? 0;
    if (snapshot.revision <= last) {
      metrics?.inc('cubeclicker_economy_revision_rejections_total');
      return false;
    }
    economyRevisions.set(accountId, snapshot.revision);
    for (const m of members.values()) {
      if (m.accountId === accountId) {
        m.economy = snapshot.economy;
      }
    }
    return true;
  }

  /**
   * Applies an absolute upgrade map only when its purchase revision is newer.
   *
   * This guard is separate from the economy revision: a newer credit must not suppress a
   * newest purchase's upgrades, and a late older purchase must never overwrite the newer
   * map that later credit multipliers read (AC-29).
   */
  function applyUpgradeSnapshot(
    accountId: string,
    revision: number,
    upgrades: UpgradeState,
  ): boolean {
    if (closed) {
      // A result rejected only because the hub is closed is not a stale rejection (AC-15).
      return false;
    }
    const last = upgradeRevisions.get(accountId) ?? 0;
    if (revision <= last) {
      metrics?.inc('cubeclicker_upgrade_revision_rejections_total');
      return false;
    }
    upgradeRevisions.set(accountId, revision);
    for (const m of members.values()) {
      if (m.accountId === accountId) {
        m.upgrades = upgrades;
      }
    }
    return true;
  }

  /** Queues an accepted snapshot for the 250 ms cadence (absolute totals, AC-19/AC-20). */
  function queueEconomy(accountId: string, snapshot: EconomySnapshot): void {
    economyCoalescer.queue(accountId, snapshot.revision, snapshot.economy);
    metrics?.set('cubeclicker_economy_pending_accounts', economyCoalescer.pendingAccounts());
  }

  function broadcastEconomyUpdate(userId: string, economy: EconomyState): void {
    broadcastAccount(userId, economyUpdateMessage(economy));
  }

  function broadcastUpgradesUpdate(userId: string, upgrades: UpgradeState): void {
    broadcastAccount(userId, upgradesUpdateMessage(upgrades));
  }

  /** Mirrors one account's customization onto every member (tab) of that account. */
  function updateMembersCustomization(accountId: string, customization: CustomizationState): void {
    for (const m of members.values()) {
      if (m.accountId === accountId) {
        m.customization = customization;
      }
    }
  }

  function broadcastCustomizationUpdate(userId: string, customization: CustomizationState): void {
    broadcastAccount(userId, customizationUpdateMessage(customization));
  }


  function handleCompletion(member: Member, connection: Connection, level: number): void {
    if (!isComplete(member.cube, level)) {
      sendError(connection, 'invalid_completion');
      sendSync(connection, member);
      return;
    }
    // Boundary: pending removals for this level reach every recipient before the cube is
    // replaced and before `levelAdvanced`/`worldEntered`/membership messages (AC-11).
    flushRemovalBatches();
    // Accepted-completion counter: exactly once per validated full board, before the target
    // snapshot is built, and carried with the member across a cross-server move (AC-2).
    member.sessionStats.cubesCompleted += 1;
    // Speed bonus uses the previous cube's gridSize and the server clock, before reset.
    const previousGridSize = member.cube.gridSize;
    const elapsedMs = deps.now() - member.cubeStartedAtMs;
    const bonus =
      elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(member.upgrades)) * 1000;

    const previous = locationOf(member.playerId)!;
    // The completed cube's 1-based number, captured before the next cube replaces it.
    const completedLevel = member.cube.levelIndex + 1;
    const next = createNextCube(member.cube, styleForLevel, random);
    const target = movePlan.get(member.playerId);
    // The registry re-validates the target (exists, free slot, strictly lower); `null` means
    // "stay here", so the member simply advances in place.
    const moved = target === undefined ? null : registry.moveMember(member.playerId, target);
    member.cube = next;
    member.yawSteps = 0;
    member.pitchSteps = 0;
    member.cubeStartedAtMs = deps.now();

    // Account credit (fire-and-forget): cube coins (with speed bonus) + cubesDestroyed.
    if (member.accountId !== null && economyRepo !== null) {
      const accountId = member.accountId;
      const coins = roundCoins(COINS_PER_CUBE * cubeMultiplier(member.upgrades) * (bonus ? 2 : 1));
      void economyRepo.creditWithRevision(accountId, { coins, cubesDestroyed: 1 }).then((snapshot) => {
        if (closed) {
          return;
        }
        if (applyEconomySnapshot(accountId, snapshot)) {
          queueEconomy(accountId, snapshot);
        }
      });
    }

    // Account customization grant (fire-and-forget): +1 lootbox +1 key on cube completion.
    if (member.accountId !== null && economyRepo !== null) {
      const accountId = member.accountId;
      void economyRepo.grantCustomization(accountId, { lootboxes: 1, keys: 1 }).then((result) => {
        if (closed) {
          return;
        }
        updateMembersCustomization(accountId, result);
        broadcastCustomizationUpdate(accountId, result);
      });
    }

    if (moved === null) {
      const advance: LevelAdvance = {
        playerId: member.playerId,
        levelIndex: next.levelIndex,
        gridSize: next.gridSize,
        styleId: next.styleId,
        position: positionOf(previous.slot),
      };
      broadcast(previous.serverId, levelAdvancedMessage(advance));
      // One candidate per completion, after the protocol broadcast (AC-1/AC-2/AC-3).
      recordCompletion(previous.serverId, member, completedLevel, elapsedMs, bonus);
      // The same server's counters changed: one coalesced snapshot per window (AC-9).
      leaderboard.markDirty(previous.serverId);
      refreshRoomGauges();
      return;
    }
    // An executed move is itself a membership change: re-plan the remaining donors now, so
    // a freed slot that appears or moves up the chain is planned without an unrelated trigger
    // (F3). Their moves still execute only at their own completion.
    recomputePlan();
    const location = locationOf(member.playerId)!;
    send(connection, worldEnteredMessage(placementFor(member)));
    broadcast(previous.serverId, memberLeftMessage(member.playerId, 'moved'));
    // The old server's leave is its own candidate, gated on that server's window; a server
    // destroyed by the move loses its buffer instead (AC-7).
    if (serverHasMembers(previous.serverId)) {
      recordActivity(previous.serverId, {
        type: 'memberLeft',
        playerId: member.playerId,
        name: member.name,
      });
      leaderboard.markDirty(previous.serverId);
    } else {
      activity.dropServer(previous.serverId);
      // A destroyed server owns no snapshot and no pending flush.
      leaderboard.dropServer(previous.serverId);
    }
    broadcast(location.serverId, memberJoinedMessage(memberState(member)), member.playerId);
    // The completion is the sole new-server activity candidate for this move (the move-in
    // join is suppressed), recorded after the target server's protocol messages (AC-7/AC-14).
    recordCompletion(location.serverId, member, completedLevel, elapsedMs, bonus);
    // The mover's counters (including this completion) belong to the target server's snapshot.
    leaderboard.markDirty(location.serverId);
    refreshRoomGauges();
  }

  /**
   * Records the one completion candidate: `levelMilestone` > `fastClear` > `cubeCleared`.
   *
   * The fast-clear predicate is the same boolean that doubles the completion's coins, so the
   * feed and the economy cannot disagree about what a fast clear is (AC-2/AC-3).
   */
  function recordCompletion(
    serverId: number,
    member: Member,
    completedLevel: number,
    elapsedMs: number,
    bonus: boolean,
  ): void {
    if (completedLevel % ACTIVITY_MILESTONE_EVERY === 0) {
      recordActivity(serverId, {
        type: 'levelMilestone',
        playerId: member.playerId,
        name: member.name,
        level: completedLevel,
      });
      return;
    }
    if (bonus) {
      recordActivity(serverId, {
        type: 'fastClear',
        playerId: member.playerId,
        name: member.name,
        level: completedLevel,
        elapsedMs,
      });
      return;
    }
    recordActivity(serverId, {
      type: 'cubeCleared',
      playerId: member.playerId,
      name: member.name,
      level: completedLevel,
    });
  }

  async function handlePurchaseUpgrade(member: Member, connection: Connection, upgradeId: string): Promise<void> {
    if (closed) {
      return;
    }
    // Guests never trigger a DB write or broadcast (silent no-op).
    if (member.accountId === null) {
      return;
    }
    const accountId = member.accountId;
    if (economyRepo === null) {
      return;
    }
    // Reload upgrades from the repository first, then derive cost/currentLevel from DB value.
    const loaded = await economyRepo.findUpgradesByUserId(accountId);
    if (closed) {
      return;
    }

    // Validate catalog.
    if (!isValidUpgradeId(upgradeId)) {
      sendError(connection, 'unknown_upgrade');
      return;
    }
    const currentLevel = upgradeLevel(loaded, upgradeId);
    const upgradeDef = UPGRADE_CATALOG.find((d) => d.id === upgradeId);
    if (upgradeDef !== undefined && currentLevel >= upgradeDef.maxLevel) {
      sendError(connection, 'max_level');
      return;
    }

    const cost = upgradeCost(upgradeId, currentLevel);
    const result = await economyRepo.purchaseUpgrade(accountId, upgradeId, cost, currentLevel);
    if (closed) {
      return;
    }
    if (result === null) {
      sendError(connection, 'insufficient_funds');
      return;
    }
    const economySnapshot: EconomySnapshot = {
      economy: result.economy,
      revision: result.revision,
    };
    // Economy and upgrades are guarded independently. The economy result is applied and
    // flushed first (the accepted pre-feature frame order); an older result never regresses
    // the totals, and does not suppress the newest purchase's upgrades below.
    if (applyEconomySnapshot(accountId, economySnapshot)) {
      // Explicit action: queue and flush now (the forced flush cancels the automatic window
      // and sends the post-purchase absolute totals exactly once).
      queueEconomy(accountId, economySnapshot);
      economyCoalescer.flush(accountId);
    }
    // Upgrades apply and broadcast only when this purchase is newer than the last applied
    // purchase; an older purchase resolving late is dropped before it can overwrite the
    // newer map or reach the wire.
    if (applyUpgradeSnapshot(accountId, result.revision, result.upgrades)) {
      broadcastUpgradesUpdate(accountId, result.upgrades);
    }
  }

  async function handleOpenLootbox(member: Member, connection: Connection): Promise<void> {
    if (member.accountId === null || economyRepo === null) {
      return;
    }
    // Per-member in-flight guard (AC-20): a second open from the same member/connection while
    // the first awaits the repository is dropped silently — no draw, no decrement, no error.
    if (openingMembers.has(member.playerId)) {
      return;
    }
    openingMembers.add(member.playerId);
    try {
      const accountId = member.accountId;
      // One weighted draw from the captured hub stream, before the repository await (AC-18).
      const partId = selectLootPart(random);
      const definition = partDefinition(partId);
      if (definition.rarity === 'standard') {
        // Unreachable: `selectLootPart` only returns lootable parts.
        throw new Error(`selectLootPart returned a standard part: ${partId}`);
      }
      const result = await economyRepo.applyLootboxOpenV2(accountId, partId);
      if (closed) {
        return;
      }
      if ('reason' in result) {
        sendError(connection, result.reason);
        return;
      }
      const state = result.state;
      updateMembersCustomization(accountId, state);
      broadcastCustomizationUpdate(accountId, state);
      send(
        connection,
        lootboxOpenedMessage({
          partId,
          slot: definition.slot,
          rarity: definition.rarity,
          duplicate: result.duplicate,
          lootboxes: state.lootboxes,
          keys: state.keys,
          parts: positivePartCounts(state.parts),
          appearance: state.appearance,
        }),
      );
      // Only a drawn epic is a server activity candidate (rare/standard/failed/guest never);
      // the member's current server owns it (AC-4).
      if (definition.rarity === 'epic') {
        const location = locationOf(member.playerId);
        if (location !== null) {
          recordActivity(location.serverId, {
            type: 'epicLoot',
            playerId: member.playerId,
            name: member.name,
            partId,
          });
        }
      }
    } catch {
      // A repository/protocol failure releases the guard in `finally` and sends nothing:
      // retrying is the client's decision (the transport performs no automatic retry, AC-20).
    } finally {
      openingMembers.delete(member.playerId);
    }
  }

  async function handleEquipPart(member: Member, connection: Connection, partId: string): Promise<void> {
    if (member.accountId === null || economyRepo === null) {
      return;
    }
    const targets = resolveEquipTargets(partId);
    if (targets === null) {
      sendError(connection, 'unknown_part');
      return;
    }
    const accountId = member.accountId;
    const current = await economyRepo.findCustomizationByUserId(accountId);
    if (closed) {
      return;
    }
    // All-or-nothing ownership (AC-28): a legacy multi-slot id needs both v2 parts owned.
    if (!targets.every((target) => ownsPart(current, target.partId))) {
      sendError(connection, 'not_owned');
      return;
    }
    // Re-equipping every target slot with the same part is a no-op (AC-22).
    const pending = targets.filter((target) => current.appearance[target.slot] !== target.partId);
    if (pending.length === 0) {
      return;
    }
    let state = current;
    for (const target of pending) {
      state = await economyRepo.setSlotAppearance(accountId, target.slot, target.partId);
      if (closed) {
        return;
      }
    }
    updateMembersCustomization(accountId, state);
    broadcastCustomizationUpdate(accountId, state);
  }

  async function handleUnequipPart(
    member: Member,
    connection: Connection,
    slotId: string,
  ): Promise<void> {
    if (member.accountId === null || economyRepo === null) {
      return;
    }
    if (!isValidSlotId(slotId)) {
      sendError(connection, 'unknown_slot');
      return;
    }
    const accountId = member.accountId;
    const current = await economyRepo.findCustomizationByUserId(accountId);
    if (closed) {
      return;
    }
    const equipped = current.appearance[slotId];
    // A missing slot and a slot resolving to its standard part are already at the default.
    if (equipped === undefined || equipped === defaultPartForSlot(slotId)) {
      return;
    }
    const state = await economyRepo.setSlotAppearance(accountId, slotId, null);
    if (closed) {
      return;
    }
    updateMembersCustomization(accountId, state);
    broadcastCustomizationUpdate(accountId, state);
  }

  function handleRotate(member: Member, connection: Connection, yawSteps: number, pitchSteps: number): void {
    const now = deps.now();
    const rate = member.rotateRate;
    while (rate.admitted.length > 0 && rate.admitted[0]! <= now - RATE_WINDOW_MS) {
      rate.admitted.shift();
    }
    if (rate.admitted.length >= ROTATE_RATE_LIMIT) {
      // Dropped silently: no state change, no broadcast, no reply (but still counted).
      metrics?.inc('cubeclicker_rate_limit_drops_total', { scope: 'rotate' });
      return;
    }
    rate.admitted.push(now);
    const clampedYaw = ((yawSteps % 4) + 4) % 4;
    const clampedPitch = Math.max(-1, Math.min(1, pitchSteps));
    member.yawSteps = clampedYaw;
    member.pitchSteps = clampedPitch;
    const location = locationOf(member.playerId);
    if (location !== null) {
      broadcast(location.serverId, cubeRotatedMessage(member.playerId, clampedYaw, clampedPitch), member.playerId);
    }
  }

  /**
   * Answers a diagnostic `ping` with the exact echoed `pong`.
   *
   * One accepted ping per 1000 ms per connection (boundary at exactly +1000 ms); later
   * pings in the window are dropped and counted. It runs before `memberFor`, so a
   * connection can measure RTT before joining, and it touches no membership/game state.
   */
  function handlePing(connection: Connection, t: number): void {
    const now = deps.now();
    if (connection.lastPingAtMs !== null && now - connection.lastPingAtMs < PING_RATE_LIMIT_MS) {
      metrics?.inc('cubeclicker_rate_limit_drops_total', { scope: 'ping' });
      return;
    }
    connection.lastPingAtMs = now;
    send(connection, pongMessage(t));
  }

  function handleMessage(connection: Connection, raw: unknown): void {
    // A late frame after shutdown is inert before decoding or touching rate-limit state.
    if (closed) {
      return;
    }
    const frame = frameOf(raw);
    if (frame === null) {
      metrics?.inc('cubeclicker_ws_messages_received_total', { type: 'invalid' });
      sendError(connection, 'bad_message');
      return;
    }
    // Oversized frames are dropped before decoding (AC-20), even when they would parse.
    if (frame.bytes > config.maxMessageBytes) {
      metrics?.inc('cubeclicker_ws_messages_received_total', { type: 'oversized' });
      sendError(connection, 'bad_message');
      return;
    }
    const decoded = parseClientMessage(frame.text);
    if (!decoded.ok) {
      metrics?.inc('cubeclicker_ws_messages_received_total', { type: 'invalid' });
      sendError(connection, 'bad_message');
      return;
    }
    const message = decoded.message;
    metrics?.inc('cubeclicker_ws_messages_received_total', { type: message.type });
    if (message.type === 'ping') {
      handlePing(connection, message.t);
      return;
    }
    if (message.type === 'join') {
      handleJoin(connection, message.mode);
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
    if (message.type === 'cubeCompleted') {
      handleCompletion(member, connection, message.level);
      return;
    }
    if (message.type === 'rotate') {
      handleRotate(member, connection, message.yawSteps, message.pitchSteps);
      return;
    }
    if (message.type === 'purchaseUpgrade') {
      void handlePurchaseUpgrade(member, connection, message.upgradeId);
      return;
    }
    if (message.type === 'openLootbox') {
      void handleOpenLootbox(member, connection);
      return;
    }
    if (message.type === 'equipPart') {
      void handleEquipPart(member, connection, message.partId);
      return;
    }
    if (message.type === 'unequipPart') {
      void handleUnequipPart(member, connection, message.slotId);
      return;
    }
  }

  return {
    hasCapacity(): boolean {
      return connections.size < config.maxConnections;
    },

    attach(
      peer: Peer,
      accountSession: AccountSession | null = null,
      connectionId?: string,
    ): void {
      // A socket attached after shutdown is closed immediately; no listener or timer is
      // created for it (AC-30).
      if (closed) {
        peer.close();
        return;
      }
      // Backstop for direct hub users (the route checks `hasCapacity` before hello): a socket
      // beyond the cap is closed before any state is created for it.
      if (connections.size >= config.maxConnections) {
        peer.close();
        const rejectedId = connectionId ?? UNKNOWN_CONNECTION_ID;
        metrics?.inc('cubeclicker_ws_connections_rejected_total', { reason: 'capacity' });
        log?.warn('ws_connection_rejected', { connectionId: rejectedId, reason: 'capacity' });
        return;
      }
      const connection: Connection = {
        peer,
        accountSession,
        connectionId: connectionId ?? null,
        playerId: null,
        missedPongs: 0,
        awaitingPong: false,
        heartbeat: null,
        wasJoined: false,
        attachedAtMs: deps.now(),
        closeReason: 'client',
        lastPingAtMs: null,
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
      refreshConnectionGauges();
      refreshRoomGauges();
      metrics?.inc('cubeclicker_ws_connections_total');
      log?.info('ws_connection_opened', { connectionId: connectionIdOf(connection) });
    },

    connectionCount(): number {
      return connections.size;
    },

    revisionStateForTesting(): { economyRevisions: number; upgradeRevisions: number } {
      return {
        economyRevisions: economyRevisions.size,
        upgradeRevisions: upgradeRevisions.size,
      };
    },

    close(): void {
      if (closed) {
        return;
      }
      // Capture the summary before the state is cleared; `hub_closed` is the shutdown line.
      const summary = {
        connections: connections.size,
        members: members.size,
        servers: registry.serverCount(),
      };
      // Flip the guard first: every late frame, continuation, enqueue and send is inert from
      // this point (AC-30).
      closed = true;
      removalBatcher.discard();
      economyCoalescer.discard();
      leaderboard.discard();
      for (const connection of connections) {
        connection.closeReason = 'server';
        metrics?.inc('cubeclicker_ws_connections_closed_total', { reason: 'server' });
        metrics?.observe(
          'cubeclicker_ws_connection_duration_seconds',
          connectionDurationSeconds(connection),
        );
        log?.info('ws_connection_closed', {
          connectionId: connectionIdOf(connection),
          reason: 'server',
          durationMs: connectionDurationMs(connection),
          wasJoined: connection.wasJoined,
        });
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
      members.clear();
      tokens.clear();
      openingMembers.clear();
      economyRevisions.clear();
      upgradeRevisions.clear();
      // Terminal feed teardown: after this no record/snapshot/drop can produce state or a frame
      // (AC-11/AC-25).
      activity.clear();
      // Metrics-only shutdown reset (AC-13); the registry object is not cleared, so other
      // counters keep their process totals and no registry equality is asserted after close.
      metrics?.set('cubeclicker_removal_batch_pending_groups', 0);
      metrics?.set('cubeclicker_economy_pending_accounts', 0);
      metrics?.set('cubeclicker_ws_connections_open', 0);
      metrics?.set('cubeclicker_members_active', 0);
      metrics?.set('cubeclicker_servers_active', 0);
      log?.info('hub_closed', summary);
    },
  };
}
