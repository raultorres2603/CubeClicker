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
  encodeServerMessage,
  errorMessage,
  levelAdvancedMessage,
  memberJoinedMessage,
  memberLeftMessage,
  miniCubeRemovedMessage,
  cubeRotatedMessage,
  parseClientMessage,
  stateSyncMessage,
  economyUpdateMessage,
  upgradesUpdateMessage,
  welcomeMessage,
  worldEnteredMessage,
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
  customizationUpdateMessage,
  lootboxOpenedMessage,
} from './protocol.js';
import {
  createServerRegistry,
  worldPosition,
  type ServerRegistry,
} from './servers.js';
import type { EconomyRepository } from '../auth/economy-repository.js';
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

/** The trailing window of the explode rate limit: 30 admitted attempts per second (AC-14). */
const RATE_WINDOW_MS = 1000;

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
  /** Attaches one socket: registers the lifecycle listeners and the heartbeat. */
  attach(peer: Peer, accountSession?: AccountSession | null): void;
  /** Number of currently attached sockets (bounded by `config.maxConnections`). */
  connectionCount(): number;
  /** Clears every hub-owned timer and forgets the connections (app shutdown). */
  close(): void;
}

/** One attached socket and its per-connection state. */
interface Connection {
  peer: Peer;
  /** Resolved from the upgrade cookie; never from client input. */
  accountSession: AccountSession | null;
  /** `null` until a successful join/rejoin. */
  playerId: string | null;
  /** Consecutive pings that received no pong (reset by any pong). */
  missedPongs: number;
  /** Whether the previous heartbeat tick sent a ping that is still unanswered. */
  awaitingPong: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
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
  const registry: ServerRegistry = createServerRegistry(config.maxUsersPerServer);
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

  const connections = new Set<Connection>();
  const members = new Map<string, Member>();
  const tokens = new Map<string, string>();
  const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Member ids with an `openLootbox` awaiting the repository (per-member in-flight guard). */
  const openingMembers = new Set<string>();
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

  /** Sends to every member of `serverId` that still has an open socket (holes skipped). */
  function broadcast(serverId: number, message: ServerMessage, except?: string): void {
    const server = registry.servers().find((candidate) => candidate.id === serverId);
    if (server === undefined) {
      return;
    }
    for (const playerId of server.members) {
      if (playerId === null || playerId === except) {
        continue;
      }
      sendToPlayer(playerId, message);
    }
  }

  /**
   * The member's current placement, derived from the registry (never cached).
   *
   * The registry's `members` array is the server's slot table (index = slot − 1), so the
   * index is the member's actual slot — a vacated slot next to them leaves it unchanged.
   */
  function locationOf(playerId: string): { serverId: number; slot: number } | null {
    for (const server of registry.servers()) {
      const slotIndex = server.members.indexOf(playerId);
      if (slotIndex !== -1) {
        return { serverId: server.id, slot: slotIndex + 1 };
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
    const server = registry.servers().find((candidate) => candidate.id === serverId);
    if (server === undefined) {
      return [];
    }
    const roster: MemberState[] = [];
    for (const playerId of server.members) {
      if (playerId !== null) {
        roster.push(memberState(members.get(playerId)!));
      }
    }
    return roster;
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

    // Load persisted economy before creating the member (account + repo present).
    let loadedEconomy: EconomyState = { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 };
    let loadedUpgrades: UpgradeState = {};
    let loadedCustomization: CustomizationState = { lootboxes: 0, keys: 0, parts: {}, appearance: {} };
    let touched = false;
    let creditedCoins = 0;
    if (isAccount && accountId !== null && economyRepo !== null) {
      const found = await economyRepo.findByUserId(accountId);
      if (found !== null) {
        loadedEconomy = found;
      }
      loadedUpgrades = await economyRepo.findUpgradesByUserId(accountId);
      loadedCustomization = await economyRepo.findCustomizationByUserId(accountId);
      const lastSeenAt = await economyRepo.findLastSeenAt(accountId);
      const now = deps.now();
      touched = await economyRepo.touchLastSeen(accountId, now, lastSeenAt);
      if (touched) {
        const elapsed = lastSeenAt === null ? 0 : now - lastSeenAt;
        const coins = idleCoins(elapsed, loadedUpgrades);
        if (coins > 0) {
          loadedEconomy = await economyRepo.credit(accountId, { coins });
          creditedCoins = coins;
        }
      }
    }

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
      connection,
      rate: { admitted: [], lastLimitedAt: null },
      rotateRate: { admitted: [], lastLimitedAt: null },
    };
    members.set(member.playerId, member);
    tokens.set(member.token, member.playerId);
    connection.playerId = member.playerId;
    // Update in-memory members + broadcast economyUpdate when credited (F11).
    if (isAccount && accountId !== null && economyRepo !== null && touched && creditedCoins > 0) {
      for (const m of members.values()) {
        if (m.accountId === accountId) {
          m.economy = loadedEconomy;
        }
      }
      broadcastEconomyUpdate(accountId, loadedEconomy);
    }
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
    // True trailing-second window: forget every admitted attempt that is now at or before
    // `now − 1000 ms`, so at most 30 attempts can sit inside any 1000 ms interval (F4).
    while (rate.admitted.length > 0 && rate.admitted[0]! <= now - RATE_WINDOW_MS) {
      rate.admitted.shift();
    }
    if (rate.admitted.length >= config.clickRateLimitPerSecond) {
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
    const location = locationOf(member.playerId)!;
    broadcast(location.serverId, miniCubeRemovedMessage(member.playerId, id));

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

    // Account credit (fire-and-forget): mini-cube coins + click + face (if cleared).
    if (member.accountId !== null && economyRepo !== null) {
      const accountId = member.accountId;
      const delta = {
        coins: roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(member.upgrades)),
        clicks: 1,
        facesDestroyed: faceCleared ? 1 : 0,
      };
      void economyRepo
        .credit(accountId, delta)
        .then((result) => {
          for (const m of members.values()) {
            if (m.accountId === accountId) {
              m.economy = result;
            }
          }
          broadcastEconomyUpdate(accountId, result);
        });
    }
  }

  function broadcastEconomyUpdate(userId: string, economy: EconomyState): void {
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
      send(connection, economyUpdateMessage(economy));
    }
  }

  function broadcastUpgradesUpdate(userId: string, upgrades: UpgradeState): void {
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
      send(connection, upgradesUpdateMessage(upgrades));
    }
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
      send(connection, customizationUpdateMessage(customization));
    }
  }


  function handleCompletion(member: Member, connection: Connection, level: number): void {
    if (!isComplete(member.cube, level)) {
      sendError(connection, 'invalid_completion');
      sendSync(connection, member);
      return;
    }
    // Speed bonus uses the previous cube's gridSize and the server clock, before reset.
    const previousGridSize = member.cube.gridSize;
    const elapsedMs = deps.now() - member.cubeStartedAtMs;
    const bonus =
      elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(member.upgrades)) * 1000;

    const previous = locationOf(member.playerId)!;
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
      void economyRepo
        .credit(accountId, { coins, cubesDestroyed: 1 })
        .then((result) => {
          for (const m of members.values()) {
            if (m.accountId === accountId) {
              m.economy = result;
            }
          }
          broadcastEconomyUpdate(accountId, result);
        });
    }

    // Account customization grant (fire-and-forget): +1 lootbox +1 key on cube completion.
    if (member.accountId !== null && economyRepo !== null) {
      const accountId = member.accountId;
      void economyRepo
        .grantCustomization(accountId, { lootboxes: 1, keys: 1 })
        .then((result) => {
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
      return;
    }
    // An executed move is itself a membership change: re-plan the remaining donors now, so
    // a freed slot that appears or moves up the chain is planned without an unrelated trigger
    // (F3). Their moves still execute only at their own completion.
    recomputePlan();
    const location = locationOf(member.playerId)!;
    send(connection, worldEnteredMessage(placementFor(member)));
    broadcast(previous.serverId, memberLeftMessage(member.playerId, 'moved'));
    broadcast(location.serverId, memberJoinedMessage(memberState(member)), member.playerId);
  }

  async function handlePurchaseUpgrade(member: Member, connection: Connection, upgradeId: string): Promise<void> {
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
    if (result === null) {
      sendError(connection, 'insufficient_funds');
      return;
    }
    // Update all members with same accountId.
    for (const m of members.values()) {
      if (m.accountId === accountId) {
        m.economy = result.economy;
        m.upgrades = result.upgrades;
      }
    }
    broadcastEconomyUpdate(accountId, result.economy);
    broadcastUpgradesUpdate(accountId, result.upgrades);
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
    const equipped = current.appearance[slotId];
    // A missing slot and a slot resolving to its standard part are already at the default.
    if (equipped === undefined || equipped === defaultPartForSlot(slotId)) {
      return;
    }
    const state = await economyRepo.setSlotAppearance(accountId, slotId, null);
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
      // Dropped silently: no state change, no broadcast, no reply.
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

    attach(peer: Peer, accountSession: AccountSession | null = null): void {
      // Backstop for direct hub users (the route checks `hasCapacity` before hello): a socket
      // beyond the cap is closed before any state is created for it.
      if (connections.size >= config.maxConnections) {
        peer.close();
        return;
      }
      const connection: Connection = {
        peer,
        accountSession,
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
