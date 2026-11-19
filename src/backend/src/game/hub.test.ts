import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameConfig, type GameConfig } from './config.js';
import { allIds } from './cubes.js';
import {
  createGameHub,
  type AccountSession,
  type GameHub,
  type Peer,
  ECONOMY_BROADCAST_INTERVAL_MS,
  MINI_CUBE_BATCH_WINDOW_MS,
  PING_RATE_LIMIT_MS,
} from './hub.js';
import type { Position, ServerMessage, LeaderboardSnapshot } from './protocol.js';
import type { LogFields, LogSink } from '../observability/logging.js';
import { createMetrics, type Metrics } from '../observability/metrics.js';
import { InMemoryEconomyRepository } from '../auth/economy-repository.js';
import type { EconomyDelta, EconomySnapshot } from '../auth/economy-repository.js';
import { createServerRegistry, type ServerRegistry } from './servers.js';
import type { CustomizationState, PartIdV2 } from './parts-v2.js';
import { COINS_PER_MINI_CUBE, COINS_PER_CUBE, thresholdSeconds, roundCoins, IDLE_CAP_MS, idleCoins } from './economy.js';

/** A fake {@link Peer}: records sent frames and lets tests drive the transport events. */
class FakePeer implements Peer {
  readonly sent: string[] = [];
  pings = 0;
  closed = false;
  /** Hub-initiated `close()` calls (an abrupt test drop does not increment it). */
  closeCalls = 0;
  private readonly messageHandlers: Array<(arg?: unknown) => void> = [];
  private readonly closeHandlers: Array<() => void> = [];
  private readonly pongHandlers: Array<() => void> = [];
  private closeEmitted = false;

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closeCalls += 1;
    this.drop();
  }

  isOpen(): boolean {
    return !this.closed;
  }

  on(event: 'message' | 'close' | 'pong', handler: (arg?: unknown) => void): void {
    if (event === 'message') {
      this.messageHandlers.push(handler);
    } else if (event === 'close') {
      this.closeHandlers.push(handler as () => void);
    } else {
      this.pongHandlers.push(handler as () => void);
    }
  }

  ping(): void {
    this.pings += 1;
  }

  /** Delivers one client frame (string or the Buffer shape the `ws` transport produces). */
  receive(frame: string | Buffer): void {
    for (const handler of this.messageHandlers) {
      handler(frame);
    }
  }

  /** Answers one server ping. */
  pong(): void {
    for (const handler of this.pongHandlers) {
      handler();
    }
  }

  /** Simulates the peer going away (client drop, or the hub closing the socket). */
  drop(): void {
    if (this.closeEmitted) {
      return;
    }
    this.closed = true;
    this.closeEmitted = true;
    for (const handler of this.closeHandlers) {
      handler();
    }
  }

  messages(): ServerMessage[] {
    return this.sent.map((text) => JSON.parse(text) as ServerMessage);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** A peer whose next `send` throws synchronously (AC-2 error isolation). */
class ThrowingPeer extends FakePeer {
  failNextSend = false;

  override send(text: string): void {
    if (this.failNextSend) {
      this.failNextSend = false;
      throw new Error('peer send failed');
    }
    super.send(text);
  }
}

/** Counts `servers()` snapshots and `assign` calls while delegating every registry rule. */
class CountingRegistry implements ServerRegistry {
  snapshots = 0;
  assignCalls = 0;

  constructor(private readonly inner: ServerRegistry) {}

  serverCount(): number {
    return this.inner.serverCount();
  }

  servers() {
    this.snapshots += 1;
    return this.inner.servers();
  }

  locationOf(playerId: string) {
    return this.inner.locationOf(playerId);
  }

  forEachMember(serverId: number, visit: (playerId: string, slot: number) => void): void {
    this.inner.forEachMember(serverId, visit);
  }

  assign(joining: string) {
    this.assignCalls += 1;
    return this.inner.assign(joining);
  }

  removeMember(playerId: string) {
    return this.inner.removeMember(playerId);
  }

  moveMember(playerId: string, targetServerId: number) {
    return this.inner.moveMember(playerId, targetServerId);
  }

  plan() {
    return this.inner.plan();
  }
}

/**
 * In-memory repository that can hold a credit/purchase **result** after the write already
 * happened, so tests can resolve two async writes out of order (AC-29).
 */
class DeferredEconomyRepository extends InMemoryEconomyRepository {
  readonly creditDeltas: EconomyDelta[] = [];
  private creditHold: Promise<void> | null = null;
  private releaseCredit: (() => void) | null = null;
  private purchaseHold: Promise<void> | null = null;
  private releasePurchase: (() => void) | null = null;

  /** Holds the next `creditWithRevision` result; returns its release. */
  holdNextCredit(): () => void {
    this.creditHold = new Promise<void>((resolve) => {
      this.releaseCredit = resolve;
    });
    return () => {
      this.releaseCredit?.();
      this.releaseCredit = null;
    };
  }

  /** Holds the next `purchaseUpgrade` result; returns its release. */
  holdNextPurchase(): () => void {
    this.purchaseHold = new Promise<void>((resolve) => {
      this.releasePurchase = resolve;
    });
    return () => {
      this.releasePurchase?.();
      this.releasePurchase = null;
    };
  }

  override async creditWithRevision(userId: string, delta: EconomyDelta): Promise<EconomySnapshot> {
    this.creditDeltas.push({ ...delta });
    const snapshot = await super.creditWithRevision(userId, delta);
    const hold = this.creditHold;
    if (hold !== null) {
      this.creditHold = null;
      await hold;
    }
    return snapshot;
  }

  override async purchaseUpgrade(
    userId: string,
    upgradeId: Parameters<InMemoryEconomyRepository['purchaseUpgrade']>[1],
    cost: number,
    currentLevel: number,
  ): Promise<Awaited<ReturnType<InMemoryEconomyRepository['purchaseUpgrade']>>> {
    const result = await super.purchaseUpgrade(userId, upgradeId, cost, currentLevel);
    const hold = this.purchaseHold;
    if (hold !== null) {
      this.purchaseHold = null;
      await hold;
    }
    return result;
  }
}

/** In-memory repository that can hold the join's economy-snapshot read (AC-30). */
class DeferredJoinRepository extends InMemoryEconomyRepository {
  private snapshotHold: Promise<void> | null = null;
  private releaseSnapshot: (() => void) | null = null;

  holdEconomySnapshot(): () => void {
    this.snapshotHold = new Promise<void>((resolve) => {
      this.releaseSnapshot = resolve;
    });
    return () => {
      this.releaseSnapshot?.();
      this.releaseSnapshot = null;
    };
  }

  override async findEconomySnapshot(userId: string): Promise<EconomySnapshot | null> {
    const snapshot = await super.findEconomySnapshot(userId);
    const hold = this.snapshotHold;
    if (hold !== null) {
      this.snapshotHold = null;
      await hold;
    }
    return snapshot;
  }
}

/** The `JSON.stringify` calls whose argument is a server message of `type`. */
function encodeCallsFor(
  spy: { mock: { calls: Array<[unknown, ...unknown[]]> } },
  type: ServerMessage['type'],
): unknown[] {
  return spy.mock.calls
    .map((call) => call[0])
    .filter((value) => {
      if (typeof value !== 'object' || value === null) {
        return false;
      }
      return (value as { type?: unknown }).type === type;
    });
}

/** A deterministic hub plus the helpers every test needs. */
interface Harness {
  readonly config: GameConfig;
  readonly hub: GameHub;
  connect(): FakePeer;
  join(peer: FakePeer): void;
  advance(ms: number): void;
  advanceTimersOnly(ms: number): void;
  setNow(ms: number): void;
}

/** The clock/timer surface the batching helpers need. */
interface TimerHarness {
  advance(ms: number): void;
  advanceTimersOnly(ms: number): void;
}

/** Fires the 40 ms removal window without moving the hub's click clock. */
function flushRemovals(harness: TimerHarness): void {
  harness.advanceTimersOnly(MINI_CUBE_BATCH_WINDOW_MS);
}

/** Drains the fire-and-forget repository continuations. */
async function drainMicrotasks(): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    await Promise.resolve();
  }
}

/** Resolves the credit continuations, then lets the 250 ms economy window fire. */
async function settleEconomy(harness: TimerHarness): Promise<void> {
  await drainMicrotasks();
  harness.advance(ECONOMY_BROADCAST_INTERVAL_MS);
}

function createHarness(
  overrides: Partial<GameConfig> = {},
  draw: () => number = () => 0,
): Harness {
  const config: GameConfig = { ...loadGameConfig({}), ...overrides };
  let clock = 0;
  const hub = createGameHub({
    config,
    now: () => clock,
    random: () => draw,
    timers: { setInterval, clearInterval, setTimeout, clearTimeout },
  });
  return {
    config,
    hub,
    connect(): FakePeer {
      const peer = new FakePeer();
      hub.attach(peer);
      return peer;
    },
    join(peer: FakePeer): void {
      peer.receive(JSON.stringify({ type: 'join' }));
    },
    advance(ms: number): void {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
    advanceTimersOnly(ms: number): void {
      vi.advanceTimersByTime(ms);
    },
    setNow(ms: number): void {
      clock = ms;
    },
  };
}

/** A deterministic account hub (three tabs of `u1`) with the same fake-timer controls. */
function createAccountHarness(repo: InMemoryEconomyRepository) {
  const config = loadGameConfig({});
  let clock = 0;
  const hub = createGameHub({
    config,
    now: () => clock,
    random: () => () => 0,
    timers: { setInterval, clearInterval, setTimeout, clearTimeout },
    economy: repo,
  });
  return {
    config,
    hub,
    clock: () => clock,
    setNow: (ms: number) => {
      clock = ms;
    },
    advance: (ms: number) => {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
    advanceTimersOnly: (ms: number) => {
      vi.advanceTimersByTime(ms);
    },
    connect: (userId = 'u1', username = 'alice') => {
      const peer = new FakePeer();
      hub.attach(peer, { userId, username, verified: true });
      return peer;
    },
    join: (peer: FakePeer) => {
      peer.receive(JSON.stringify({ type: 'join' }));
    },
  };
}

type WelcomeMessage = Extract<ServerMessage, { type: 'welcome' }>;

/** The single message of `type` on a peer (fails the test when absent or duplicated). */
function onlyType<T extends ServerMessage['type']>(
  peer: FakePeer,
  type: T,
): Extract<ServerMessage, { type: T }> {
  const matches = peer
    .messages()
    .filter((message): message is Extract<ServerMessage, { type: T }> => message.type === type);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function welcomeOf(peer: FakePeer): WelcomeMessage {
  return onlyType(peer, 'welcome');
}

/** Every sent text frame on `peer` whose decoded type is `type`. */
function sentTextsOfType(peer: FakePeer, type: ServerMessage['type']): string[] {
  return peer.sent.filter((text) => (JSON.parse(text) as ServerMessage).type === type);
}

/**
 * The messages other than the coalesced `leaderboardUpdate` frames.
 *
 * The leaderboard is additive and deliberately coalesced at 1 s; tests that are not about the
 * ranking assert their own exact frames through this filter instead of weakening them. The
 * leaderboard's presence, cadence and payload are pinned by the `server live leaderboard` suite
 * below.
 */
function messagesWithoutLeaderboard(peer: FakePeer): ServerMessage[] {
  return peer.messages().filter((message) => message.type !== 'leaderboardUpdate');
}

/** The encoded texts other than the coalesced `leaderboardUpdate` frames. */
function sentTextsWithoutLeaderboard(peer: FakePeer): string[] {
  return peer.sent.filter(
    (text) => (JSON.parse(text) as ServerMessage).type !== 'leaderboardUpdate',
  );
}

type ActivityEventFrame = Extract<ServerMessage, { type: 'activityEvent' }>;

/** An exact `activityEvent` frame for a member transition (join/leave). */
function transitionActivity(
  id: number,
  at: number,
  serverId: number,
  type: 'memberJoined' | 'memberLeft',
  playerId: string,
  name: string,
): ActivityEventFrame {
  return { type: 'activityEvent', event: { id, at, serverId, type, playerId, name } };
}

/** An exact `activityEvent` frame for a non-fast, non-milestone completion. */
function clearedActivity(
  id: number,
  at: number,
  serverId: number,
  playerId: string,
  name: string,
  level: number,
): ActivityEventFrame {
  return { type: 'activityEvent', event: { id, at, serverId, type: 'cubeCleared', playerId, name, level } };
}

/** An exact `activityEvent` frame for a fast completion. */
function fastActivity(
  id: number,
  at: number,
  serverId: number,
  playerId: string,
  name: string,
  level: number,
  elapsedMs: number,
): ActivityEventFrame {
  return {
    type: 'activityEvent',
    event: { id, at, serverId, type: 'fastClear', playerId, name, level, elapsedMs },
  };
}

/** An exact `activityEvent` frame for a milestone completion. */
function milestoneActivity(
  id: number,
  at: number,
  serverId: number,
  playerId: string,
  name: string,
  level: number,
): ActivityEventFrame {
  return {
    type: 'activityEvent',
    event: { id, at, serverId, type: 'levelMilestone', playerId, name, level },
  };
}

/** An exact `activityEvent` frame for an epic loot draw. */
function epicActivity(
  id: number,
  at: number,
  serverId: number,
  playerId: string,
  name: string,
  partId: string,
): ActivityEventFrame {
  return { type: 'activityEvent', event: { id, at, serverId, type: 'epicLoot', playerId, name, partId } };
}

/** One cube's wire state; `LEVEL_0` is the first cube of every member (draw 0 → N = 3). */
interface CubeFields {
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
}

const LEVEL_0: CubeFields = {
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
};

function memberOf(
  playerId: string,
  name: string,
  position: Position,
  cube: CubeFields = LEVEL_0,
  yawSteps = 0,
  pitchSteps = 0,
  appearance: Record<string, string> = {},
): {
  playerId: string;
  name: string;
  position: Position;
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
  yawSteps: number;
  pitchSteps: number;
  appearance: Record<string, string>;
} {
  return { playerId, name, position, ...cube, yawSteps, pitchSteps, appearance };
}

/** Pinned ring positions (T1 has the formula; these are the exact doubles the hub must send). */
const X2_SLOT_1: Position = { x: 7.639437268410976, y: 0 };
const X2_SLOT_2: Position = { x: -7.639437268410976, y: 9.355612398046502e-16 };
const X3_SLOT_1: Position = { x: 11.459155902616464, y: 0 };
const X3_SLOT_2: Position = { x: -5.7295779513082294, y: 9.923920117592258 };
const X3_SLOT_3: Position = { x: -5.729577951308237, y: -9.923920117592255 };
const X4_SLOT_1: Position = { x: 15.278874536821952, y: 0 };
const X4_SLOT_2: Position = { x: 9.355612398046502e-16, y: 15.278874536821952 };
const X4_SLOT_3: Position = { x: -15.278874536821952, y: 1.8711224796093003e-15 };

function explode(peer: FakePeer, id: string, level = 0): void {
  peer.receive(JSON.stringify({ type: 'explode', id, level }));
}

/** Removes a whole level inside the 30/s budget (a 1 s gap between 30-id batches). */
function removeLevel(harness: TimerHarness, peer: FakePeer, ids: readonly string[], level = 0): void {
  ids.forEach((id, index) => {
    if (index > 0 && index % 30 === 0) {
      harness.advance(1000);
    }
    explode(peer, id, level);
  });
  // The next assertion that follows a level removal is a boundary message (`levelAdvanced`,
  // `memberLeft`, `worldEntered`): flush the batch exactly as the hub does at its boundary.
  flushRemovals(harness);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('connection lifecycle', () => {
  it('attaches a socket without sending anything (hello belongs to the route) and counts it', () => {
    const harness = createHarness();
    const peer = harness.connect();

    expect(peer.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(1);

    harness.hub.close();
    expect(harness.hub.connectionCount()).toBe(0);
    harness.advance(60_000);
    expect(peer.pings).toBe(0);
  });

  it('clears pending grace timers on close (shutdown leaves no scheduled work)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    harness.hub.close();
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);

    expect(second.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(0);
  });

  it('answers not_joined to game messages before a successful join', () => {
    const harness = createHarness();
    const peer = harness.connect();

    explode(peer, 'front:0:0');
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(peer.messages()).toEqual([
      { type: 'error', code: 'not_joined' },
      { type: 'error', code: 'not_joined' },
    ]);
  });

  it('answers bad_message for malformed, unknown and oversized frames', () => {
    const harness = createHarness();
    const peer = harness.connect();

    peer.receive('{');
    peer.receive(JSON.stringify({ type: 'dance' }));
    peer.receive(JSON.stringify({ type: 'explode', id: 'front:0:0' }));
    peer.receive('x'.repeat(1025));
    peer.receive(JSON.stringify(['join']));

    expect(peer.messages()).toEqual([
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
    ]);
  });

  it('joins with identity, slot 1 position, the first cube and a self-inclusive roster', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const peer = harness.connect();

    harness.join(peer);

    const welcome = welcomeOf(peer);
    expect(welcome.playerId).toBe('p1');
    expect(welcome.name).toBe('Player 1');
    expect(welcome.token).toMatch(/^[0-9a-f]{32}$/);
    expect(welcome.serverId).toBe(1);
    expect(welcome.maxUsers).toBe(2);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.self).toEqual({ ...LEVEL_0, yawSteps: 0, pitchSteps: 0 });
    expect(welcome.roster).toEqual([memberOf('p1', 'Player 1', X2_SLOT_1)]);
    expect(peer.messages()).toHaveLength(1);
  });

  it('places the second member in slot 2 and broadcasts memberJoined to the others only', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();

    harness.join(second);

    const welcome = welcomeOf(second);
    expect(welcome.playerId).toBe('p2');
    expect(welcome.position).toEqual(X2_SLOT_2);
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    expect(first.messages().slice(1)).toEqual([
      { type: 'memberJoined', member: memberOf('p2', 'Player 2', X2_SLOT_2) },
    ]);
    expect(second.messages()).toHaveLength(1);
  });

  it('overflows into the next fresh server and keeps broadcasts server-scoped', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();

    // Buffer is the frame shape the real `ws` transport hands over.
    third.receive(Buffer.from(JSON.stringify({ type: 'join' })));

    const welcome = welcomeOf(third);
    expect(welcome.playerId).toBe('p3');
    expect(welcome.serverId).toBe(2);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.roster).toEqual([memberOf('p3', 'Player 3', X2_SLOT_1)]);
    // Server 1 heard nothing about the overflow (server-scoped broadcasts).
    expect(first.messages()).toHaveLength(2);
    expect(second.messages()).toHaveLength(1);
  });

  it('rejects a second join or rejoin on a joined connection with bad_message', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const token = welcomeOf(peer).token;

    peer.receive(JSON.stringify({ type: 'join' }));
    peer.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(peer.messages().slice(1)).toEqual([
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
    ]);
    expect(peer.messages()).toHaveLength(3);
  });
});

describe('reconnect grace', () => {
  it('keeps a disconnected member in the roster during the window (their slot stays taken)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const firstMessageCount = first.messages().length;

    first.drop();

    expect(harness.hub.connectionCount()).toBe(1);
    expect(second.messages()).toHaveLength(1);
    expect(first.messages()).toHaveLength(firstMessageCount);
    expect(firstMessageCount).toBe(2);

    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(third).serverId).toBe(2);
  });

  it('removes the member at exactly the grace deadline and broadcasts memberLeft left', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    harness.advance(harness.config.reconnectGraceMs - 1);
    expect(messagesWithoutLeaderboard(second)).toEqual([]);

    harness.advance(1);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);

    // p1's slot 1 is reusable; p2 keeps slot 2 (positions never shuffle).
    const third = harness.connect();
    harness.join(third);
    const welcome = welcomeOf(third);
    expect(welcome.serverId).toBe(1);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.roster).toEqual([
      memberOf('p3', 'Player 3', X2_SLOT_1),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
  });

  it('destroys an emptied server at grace expiry and never reuses its id', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    expect(welcomeOf(first).serverId).toBe(1);

    first.drop();
    harness.advance(harness.config.reconnectGraceMs);

    const second = harness.connect();
    harness.join(second);
    const welcome = welcomeOf(second);
    expect(welcome.serverId).toBe(2);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.roster).toEqual([memberOf('p2', 'Player 2', X2_SLOT_1)]);
  });

  it('resumes the same identity, server and cube within the window without a roster change', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const token = welcomeOf(first).token;
    const second = harness.connect();
    harness.join(second);
    explode(first, 'front:0:0');
    flushRemovals(harness);
    first.drop();
    second.clear();
    first.clear();

    harness.advance(harness.config.reconnectGraceMs - 1);
    const resumed = harness.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));

    const welcome = welcomeOf(resumed);
    expect(welcome.playerId).toBe('p1');
    expect(welcome.token).toBe(token);
    expect(welcome.serverId).toBe(1);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.self).toEqual({
      levelIndex: 0,
      gridSize: 3,
      styleId: 'obsidian-neon',
      removedIds: ['front:0:0'],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1, {
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
      }),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    // No membership change is visible to the others, and the grace timer was cancelled.
    expect(messagesWithoutLeaderboard(second)).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(2);
    harness.advance(1);
    expect(messagesWithoutLeaderboard(second)).toEqual([]);
  });

  it('fails a resume at exactly the deadline and finalises the removal', () => {    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const token = welcomeOf(first).token;
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    harness.setNow(harness.config.reconnectGraceMs);
    const late = harness.connect();
    late.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(late.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);
    // The pending grace timer was cleared: no second memberLeft.
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(second)).toHaveLength(2);
  });

  it('reschedules a grace timer that fires before the deadline instead of dropping the member', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    // The timer fires while the clock has not advanced: the member is still inside grace.
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(second)).toEqual([]);

    // The rescheduled timer reaches the deadline and removes the member.
    harness.setNow(harness.config.reconnectGraceMs);
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);
  });

  it('answers resume_failed for an unknown token and then accepts a join on the same connection', () => {
    const harness = createHarness();
    const peer = harness.connect();

    peer.receive(JSON.stringify({ type: 'rejoin', token: '0'.repeat(32) }));
    expect(peer.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);

    harness.join(peer);
    expect(welcomeOf(peer).playerId).toBe('p1');
    expect(peer.messages()).toHaveLength(2);
  });

  it('refuses to resume an identity whose socket is still open', () => {
    const harness = createHarness();
    const first = harness.connect();
    harness.join(first);
    const token = welcomeOf(first).token;
    const intruder = harness.connect();

    intruder.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(intruder.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);
    expect(first.messages()).toHaveLength(1);
    expect(harness.hub.connectionCount()).toBe(2);
  });

  it('drops broadcasts to a member in grace without disturbing active members', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const firstMessageCount = first.messages().length;
    first.drop();
    second.clear();

    explode(second, 'front:0:0');
    flushRemovals(harness);

    expect(second.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p2', id: 'front:0:0' },
    ]);
    expect(first.messages()).toHaveLength(firstMessageCount);
    expect(firstMessageCount).toBe(2);
  });
});

describe('heartbeat', () => {
  it('pings every 30 s and terminates at the second missed pong', () => {
    const harness = createHarness();
    const peer = harness.connect();

    harness.advance(30_000);
    expect(peer.pings).toBe(1);
    harness.advance(30_000);
    expect(peer.pings).toBe(2);
    expect(peer.closed).toBe(false);

    // The pings at 30 s and 60 s were both unanswered: the third tick terminates.
    harness.advance(30_000);
    expect(peer.pings).toBe(3);
    expect(peer.closed).toBe(true);
    expect(harness.hub.connectionCount()).toBe(0);
  });

  it('resets the missed-pong count on every pong', () => {
    const harness = createHarness();
    const peer = harness.connect();

    for (let tick = 0; tick < 4; tick += 1) {
      harness.advance(30_000);
      peer.pong();
    }

    expect(peer.pings).toBe(4);
    expect(peer.closed).toBe(false);
  });

  it('keeps a socket alive when a pong arrives after two missed pings', () => {
    const harness = createHarness();
    const peer = harness.connect();

    harness.advance(30_000);
    harness.advance(30_000);
    peer.pong();
    harness.advance(30_000);

    expect(peer.pings).toBe(3);
    expect(peer.closed).toBe(false);
  });

  it('closes sockets beyond the connection cap and reports capacity', () => {
    const harness = createHarness({ maxConnections: 2 });
    expect(harness.hub.hasCapacity()).toBe(true);
    const first = harness.connect();
    const second = harness.connect();
    expect(harness.hub.hasCapacity()).toBe(false);
    const rejected = harness.connect();

    expect(rejected.closed).toBe(true);
    expect(rejected.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(2);

    first.drop();
    expect(harness.hub.connectionCount()).toBe(1);
    expect(harness.hub.hasCapacity()).toBe(true);
    const accepted = harness.connect();
    expect(accepted.closed).toBe(false);
    expect(harness.hub.connectionCount()).toBe(2);
    expect(second.closed).toBe(false);
  });
});

describe('explode broadcasts', () => {
  it('broadcasts a valid explode to every member of the server including the origin', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const other = harness.connect();
    harness.join(other);
    first.clear();
    second.clear();
    other.clear();

    explode(first, 'front:0:0');
    flushRemovals(harness);

    const expected = [{ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' }] as const;
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);
    expect(other.messages()).toEqual([]);
  });

  it('rejects unknown, removed and wrong-level clicks with invalid_click + stateSync to the origin only', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    explode(first, 'front:0:0');
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
    expect(second.messages()).toEqual([]);

    first.clear();
    explode(first, 'front:9:9');
    explode(first, 'front:0:1', 1);
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
      },
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
    expect(second.messages()).toEqual([]);
  });

  it('drops an oversized frame even when the payload would be a valid click', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    peer.clear();

    peer.receive(
      JSON.stringify({ type: 'explode', id: 'front:0:0', level: 0, pad: 'x'.repeat(1100) }),
    );
    expect(peer.messages()).toEqual([{ type: 'error', code: 'bad_message' }]);

    peer.clear();
    explode(peer, 'front:0:0');
    flushRemovals(harness);
    expect(peer.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
  });

  it('drops the 31st explode in a trailing second and keeps the window closed until it ages out', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    peer.clear();

    for (let index = 0; index < 30; index += 1) {
      explode(peer, ids[index]!);
    }
    flushRemovals(harness);
    expect(peer.messages()).toEqual([
      { type: 'miniCubesRemoved', playerId: 'p1', ids: ids.slice(0, 30) },
    ]);

    peer.clear();
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);

    peer.clear();
    explode(peer, ids[31]!);
    expect(peer.messages()).toEqual([]);

    // 999 ms after the first admitted attempt all 30 are still inside the trailing second.
    harness.advance(999);
    explode(peer, ids[31]!);
    expect(messagesWithoutLeaderboard(peer)).toEqual([]);

    // At exactly +1000 ms the t = 0 attempts are outside (now − 1000, now]: quota is fresh.
    harness.advance(1);
    explode(peer, ids[30]!);
    flushRemovals(harness);
    expect(messagesWithoutLeaderboard(peer)).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[30]! },
    ]);
  });

  it('keeps the window closed for a burst that a fixed one-second window would admit (F4)', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    harness.advance(900);
    peer.clear();

    for (let index = 0; index < 30; index += 1) {
      explode(peer, ids[index]!);
    }
    flushRemovals(harness);
    expect(peer.messages()).toEqual([
      { type: 'miniCubesRemoved', playerId: 'p1', ids: ids.slice(0, 30) },
    ]);

    // A fixed window anchored at join time (t = 0) would reset at t = 1000 and accept this
    // click. The trailing window still contains the 30 attempts from t = 900 → dropped.
    peer.clear();
    harness.advance(100);
    explode(peer, ids[30]!);
    expect(messagesWithoutLeaderboard(peer)).toEqual([{ type: 'error', code: 'rate_limited' }]);

    // Still inside the burst's trailing second at 999 ms after it.
    peer.clear();
    harness.advance(899);
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([]);

    // The burst ages out exactly one second after it was admitted.
    harness.advance(1);
    explode(peer, ids[30]!);
    flushRemovals(harness);
    expect(messagesWithoutLeaderboard(peer)).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[30]! },
    ]);
  });

  it('reports rate_limited at most once per trailing second (F4)', () => {
    const harness = createHarness({ clickRateLimitPerSecond: 2 });
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    peer.clear();

    explode(peer, ids[0]!);
    explode(peer, ids[1]!);
    flushRemovals(harness);
    expect(peer.messages()).toEqual([
      { type: 'miniCubesRemoved', playerId: 'p1', ids: [ids[0]!, ids[1]!] },
    ]);

    peer.clear();
    explode(peer, ids[2]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);

    // Dropped attempts inside the same second never repeat the error.
    peer.clear();
    harness.advance(400);
    explode(peer, ids[2]!);
    harness.advance(599);
    explode(peer, ids[2]!);
    expect(messagesWithoutLeaderboard(peer)).toEqual([]);

    // At +1000 ms the first two attempts age out: two are admitted, the third reports again.
    harness.advance(1);
    explode(peer, ids[2]!);
    explode(peer, ids[3]!);
    flushRemovals(harness);
    expect(messagesWithoutLeaderboard(peer)).toEqual([
      { type: 'miniCubesRemoved', playerId: 'p1', ids: [ids[2]!, ids[3]!] },
    ]);

    peer.clear();
    explode(peer, ids[4]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);
  });
});

describe('cube completion', () => {
  it('advances a completed cube on the same server and announces levelAdvanced to all members', () => {
    const draws = [0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    removeLevel(harness, first, allIds(3));
    first.clear();
    second.clear();

    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const expected = [
      {
        type: 'levelAdvanced',
        playerId: 'p1',
        levelIndex: 1,
        gridSize: 5,
        styleId: 'crimson-alloy',
        position: X2_SLOT_1,
        removedIds: [],
      },
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ] as const;
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);

    // The fresh board is authoritative: a level-1 id is accepted.
    first.clear();
    explode(first, 'front:0:0', 1);
    flushRemovals(harness);
    expect(first.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
  });

  it('rejects incomplete cubes and wrong levels with invalid_completion + stateSync to the origin', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    explode(peer, 'front:0:0');
    explode(peer, 'front:0:1');
    peer.clear();

    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(peer.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0', 'front:0:1'],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);

    peer.clear();
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 3 }));
    expect(peer.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0', 'front:0:1'],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
  });

  it('merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)', () => {
    const draws = [0, 0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    const thirdToken = welcomeOf(third).token;
    expect(welcomeOf(third).serverId).toBe(2);

    // The lone server-1 member disconnected, and their grace expired exactly at the window.
    first.drop();
    second.clear();
    third.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);
    expect(messagesWithoutLeaderboard(third)).toEqual([]);

    // The server-2 member finishes their cube: the planned move executes on completion.
    removeLevel(harness, third, allIds(3));
    second.clear();
    third.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const moved = memberOf('p3', 'Player 3', X2_SLOT_1, {
      levelIndex: 1,
      gridSize: 5,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(third.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p3',
        name: 'Player 3',
        token: thirdToken,
        serverId: 1,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 5,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        // The freed slot 1 is the lowest free slot; p2 keeps slot 2 (stable positions).
        roster: [moved, memberOf('p2', 'Player 2', X2_SLOT_2)],
        // Only the fresh `memberLeft` (age 1000 ms) travels: the `at: 0` join is TTL-expired.
        activity: [
          transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1').event,
        ],
        leaderboard: {
          serverId: 1,
          at: 31_000,
          entries: [
            { playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
        identity: { kind: 'guest', playerId: 'p3' },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      clearedActivity(3, 31_000, 1, 'p3', 'Player 3', 1),
    ]);
    expect(second.messages()).toEqual([
      { type: 'memberJoined', member: moved },
      clearedActivity(3, 31_000, 1, 'p3', 'Player 3', 1),
    ]);

    // Server 2 was destroyed and its id is never reused: the next join creates server 3.
    const fourth = harness.connect();
    harness.join(fourth);
    const welcome = welcomeOf(fourth);
    expect(welcome.serverId).toBe(3);
    expect(welcome.roster).toEqual([memberOf('p4', 'Player 4', X2_SLOT_1)]);
  });

  it('announces memberLeft moved to the vacated server and memberJoined to the target', () => {
    const draws = [0, 0, 0, 0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 3 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    const fourth = harness.connect();
    harness.join(fourth);
    const fifth = harness.connect();
    harness.join(fifth);
    expect(welcomeOf(fourth).serverId).toBe(2);
    expect(welcomeOf(fifth).serverId).toBe(2);
    const fourthToken = welcomeOf(fourth).token;

    // Freeing one slot on server 1 plans the server-2 slot holder onto it.
    second.drop();
    first.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(first)).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2'),
    ]);
    expect(messagesWithoutLeaderboard(third)).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2'),
    ]);
    expect(messagesWithoutLeaderboard(fourth)).toEqual([]);
    expect(messagesWithoutLeaderboard(fifth)).toEqual([]);
    // Drop the additive ranking frames so the protocol assertions below are exact.
    first.clear();
    third.clear();
    fourth.clear();
    fifth.clear();

    fourth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    // Not complete yet: nothing happens server-side.
    expect(fourth.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p4',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);

    fourth.clear();
    fifth.clear();
    first.clear();
    third.clear();
    removeLevel(harness, fourth, allIds(3));
    fourth.clear();
    fifth.clear();
    first.clear();
    third.clear();
    fourth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const moved = memberOf('p4', 'Player 4', X3_SLOT_2, {
      levelIndex: 1,
      gridSize: 5,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(fourth.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p4',
        name: 'Player 4',
        token: fourthToken,
        serverId: 1,
        maxUsers: 3,
        position: X3_SLOT_2,
        self: {
          levelIndex: 1,
          gridSize: 5,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        // p2's vacated slot 2 is the lowest free slot; p1/p3 keep slots 1/3.
        roster: [
          memberOf('p1', 'Player 1', X3_SLOT_1),
          moved,
          memberOf('p3', 'Player 3', X3_SLOT_3),
        ],
        activity: [
          transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2').event,
        ],
        leaderboard: {
          serverId: 1,
          at: 31_000,
          entries: [
            { playerId: 'p4', name: 'Player 4', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 },
            { playerId: 'p3', name: 'Player 3', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
        identity: { kind: 'guest', playerId: 'p4' },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      clearedActivity(3, 31_000, 1, 'p4', 'Player 4', 1),
    ]);
    expect(fifth.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p4', reason: 'moved' },
      transitionActivity(2, 31_000, 2, 'memberLeft', 'p4', 'Player 4'),
    ]);
    expect(first.messages()).toEqual([
      { type: 'memberJoined', member: moved },
      clearedActivity(3, 31_000, 1, 'p4', 'Player 4', 1),
    ]);
    expect(third.messages()).toEqual([
      { type: 'memberJoined', member: moved },
      clearedActivity(3, 31_000, 1, 'p4', 'Player 4', 1),
    ]);
  });

  it('re-plans after every executed move so three servers pack completely (X = 2, AC-10, F3)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 }); // draw 0 → every cube is 3×3
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    const fourth = harness.connect();
    harness.join(fourth);
    const fifth = harness.connect();
    harness.join(fifth);

    // Initial packing: [1: p1, p2] [2: p3, p4] [3: p5].
    expect(welcomeOf(first).serverId).toBe(1);
    expect(welcomeOf(first).position).toEqual(X2_SLOT_1);
    expect(welcomeOf(second).position).toEqual(X2_SLOT_2);
    expect(welcomeOf(third).serverId).toBe(2);
    expect(welcomeOf(third).position).toEqual(X2_SLOT_1);
    expect(welcomeOf(fourth).serverId).toBe(2);
    expect(welcomeOf(fourth).position).toEqual(X2_SLOT_2);
    expect(welcomeOf(fifth).serverId).toBe(3);
    expect(welcomeOf(fifth).position).toEqual(X2_SLOT_1);
    const thirdToken = welcomeOf(third).token;
    const fifthToken = welcomeOf(fifth).token;

    // p1's grace expires: the plan names only p3 (the single free server-1 slot). Nothing
    // moves yet — p3 moves only when their own cube completes.
    first.drop();
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);
    expect(messagesWithoutLeaderboard(third)).toEqual([]);
    expect(messagesWithoutLeaderboard(fourth)).toEqual([]);
    expect(messagesWithoutLeaderboard(fifth)).toEqual([]);
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();

    // p3 completes: the planned move executes into server 1's freed slot 1.
    removeLevel(harness, third, allIds(3));
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const movedThird = memberOf('p3', 'Player 3', X2_SLOT_1, {
      levelIndex: 1,
      gridSize: 3,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(third.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p3',
        name: 'Player 3',
        token: thirdToken,
        serverId: 1,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        roster: [movedThird, memberOf('p2', 'Player 2', X2_SLOT_2)],
        activity: [
          transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1').event,
        ],
        leaderboard: {
          serverId: 1,
          at: 31_000,
          entries: [
            { playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
        identity: { kind: 'guest', playerId: 'p3' },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      clearedActivity(3, 31_000, 1, 'p3', 'Player 3', 1),
    ]);
    expect(second.messages()).toEqual([
      { type: 'memberJoined', member: movedThird },
      clearedActivity(3, 31_000, 1, 'p3', 'Player 3', 1),
    ]);
    expect(fourth.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p3', reason: 'moved' },
      transitionActivity(2, 31_000, 2, 'memberLeft', 'p3', 'Player 3'),
    ]);
    expect(fifth.messages()).toEqual([]);

    // The move re-planned the remaining donors immediately: p5 (server 3) now targets the
    // hole p3 left on server 2; p4 has no strictly lower capacity and stays put.
    removeLevel(harness, fifth, allIds(3));
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    fifth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const movedFifth = memberOf('p5', 'Player 5', X2_SLOT_1, {
      levelIndex: 1,
      gridSize: 3,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(fifth.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p5',
        name: 'Player 5',
        token: fifthToken,
        serverId: 2,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        roster: [movedFifth, memberOf('p4', 'Player 4', X2_SLOT_2)],
        // Only the fresh 31 000 `memberLeft` travels; the `at: 0` join is TTL-expired.
        activity: [
          transitionActivity(2, 31_000, 2, 'memberLeft', 'p3', 'Player 3').event,
        ],
        leaderboard: {
          serverId: 2,
          at: 32_000,
          entries: [
            { playerId: 'p5', name: 'Player 5', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p4', name: 'Player 4', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
        identity: { kind: 'guest', playerId: 'p5' },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      clearedActivity(3, 32_000, 2, 'p5', 'Player 5', 1),
    ]);
    expect(fourth.messages()).toEqual([
      { type: 'memberJoined', member: movedFifth },
      clearedActivity(3, 32_000, 2, 'p5', 'Player 5', 1),
    ]);
    // Server-scoped: the server-1 members hear nothing about the server-2 move.
    expect(second.messages()).toEqual([]);
    expect(third.messages()).toEqual([]);

    // Servers 1 and 2 are full and server 3 was destroyed: the next join gets fresh id 4.
    const sixth = harness.connect();
    harness.join(sixth);
    const sixthWelcome = welcomeOf(sixth);
    expect(sixthWelcome.serverId).toBe(4);
    expect(sixthWelcome.position).toEqual(X2_SLOT_1);
    expect(sixthWelcome.roster).toEqual([memberOf('p6', 'Player 6', X2_SLOT_1)]);
  });
});

describe('stable slots (T1b)', () => {
  it('keeps the surviving members’ positions when a member’s grace expires (X = 4)', () => {
    const harness = createHarness({ maxUsersPerServer: 4 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(first).position).toEqual(X4_SLOT_1);
    expect(welcomeOf(second).position).toEqual(X4_SLOT_2);
    expect(welcomeOf(third).position).toEqual(X4_SLOT_3);

    // p2 (slot 2) disconnects and their grace expires exactly at the window.
    second.drop();
    first.clear();
    third.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(messagesWithoutLeaderboard(first)).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2'),
    ]);
    expect(messagesWithoutLeaderboard(third)).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2'),
    ]);
    first.clear();
    third.clear();

    // p3 completes: their position is still slot 3 — the vacated slot 2 did not shift them.
    removeLevel(harness, third, allIds(3));
    first.clear();
    third.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const expected = [
      {
        type: 'levelAdvanced',
        playerId: 'p3',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'crimson-alloy',
        position: X4_SLOT_3,
        removedIds: [],
      },
      clearedActivity(3, 31_000, 1, 'p3', 'Player 3', 1),
    ] as const;
    expect(first.messages()).toEqual(expected);
    expect(third.messages()).toEqual(expected);
  });

  it('places a new join in the vacated slot and leaves the other members’ positions unchanged', () => {
    const harness = createHarness({ maxUsersPerServer: 4 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    second.drop();
    harness.advance(harness.config.reconnectGraceMs);
    first.clear();
    third.clear();

    const fourth = harness.connect();
    harness.join(fourth);

    const welcome = welcomeOf(fourth);
    expect(welcome.playerId).toBe('p4');
    expect(welcome.position).toEqual(X4_SLOT_2);
    // Slot order, holes skipped: p1 slot 1, the new member slot 2, p3 still slot 3.
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X4_SLOT_1),
      memberOf('p4', 'Player 4', X4_SLOT_2),
      memberOf('p3', 'Player 3', X4_SLOT_3),
    ]);
    expect(third.messages()).toEqual([
      { type: 'memberJoined', member: memberOf('p4', 'Player 4', X4_SLOT_2) },
    ]);
  });
describe('orientation storage and rotate (T2)', () => {
  function rotate(peer, yawSteps, pitchSteps) {
    peer.receive(JSON.stringify({ type: 'rotate', yawSteps, pitchSteps }));
  }

  it('initialises member orientation to (0, 0) on join', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const peer = harness.connect();
    harness.join(peer);
    const welcome = welcomeOf(peer);
    expect(welcome.self.yawSteps).toBe(0);
    expect(welcome.self.pitchSteps).toBe(0);
    expect(welcome.roster[0].yawSteps).toBe(0);
    expect(welcome.roster[0].pitchSteps).toBe(0);
  });

  it('answers not_joined for rotate before a successful join', () => {
    const harness = createHarness();
    const peer = harness.connect();
    peer.clear();
    rotate(peer, 1, 0);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_joined' }]);
  });

  it('clamps yaw/pitch, updates storage and broadcasts cubeRotated to others only', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    rotate(first, 5, 5);
    expect(first.messages()).toEqual([]);
    expect(second.messages()).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 1, pitchSteps: 1 },
    ]);

    first.clear();
    first.receive(JSON.stringify({ type: 'explode', id: 'front:9:9', level: 0 }));
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 1,
        pitchSteps: 1,
      },
    ]);
  });

  it('clamps negative yaw and pitch to the pinned ranges', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    rotate(first, -1, -5);
    expect(second.messages()).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 3, pitchSteps: -1 },
    ]);
  });

  it('drops the 21st rotate in a trailing second silently and resets after 1000 ms', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    for (let index = 0; index < 20; index += 1) {
      rotate(first, 0, 0);
    }
    expect(second.messages()).toHaveLength(20);
    second.clear();

    rotate(first, 1, 0);
    expect(first.messages()).toEqual([]);
    expect(second.messages()).toEqual([]);

    harness.advance(999);
    rotate(first, 1, 0);
    expect(second.messages()).toEqual([]);

    harness.advance(1);
    rotate(first, 1, 0);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 1, pitchSteps: 0 },
    ]);
  });

  it('drops an oversized rotate frame as bad_message', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const peer = harness.connect();
    harness.join(peer);
    peer.clear();
    peer.receive(
      JSON.stringify({ type: 'rotate', yawSteps: 1, pitchSteps: 0, pad: 'x'.repeat(1100) }),
    );
    expect(peer.messages()).toEqual([{ type: 'error', code: 'bad_message' }]);
  });

  it('resets orientation to (0, 0) on a same-server level advance', () => {
    const draws = [0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    removeLevel(harness, first, allIds(3));
    first.clear();
    second.clear();

    rotate(first, 2, 1);
    second.clear();
    first.clear();
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    first.clear();
    first.receive(JSON.stringify({ type: 'explode', id: 'front:9:9', level: 1 }));
    const sync = onlyType(first, 'stateSync');
    expect(sync.yawSteps).toBe(0);
    expect(sync.pitchSteps).toBe(0);
  });

  it('resets orientation to (0, 0) on a server move', () => {
    const draws = [0, 0, 0, 0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(third).serverId).toBe(2);

    rotate(third, 2, -1);
    first.drop();
    second.clear();
    third.clear();
    harness.advance(harness.config.reconnectGraceMs);
    removeLevel(harness, third, allIds(3));
    second.clear();
    third.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const joined = onlyType(second, 'memberJoined');
    expect(joined.member.yawSteps).toBe(0);
    expect(joined.member.pitchSteps).toBe(0);
  });
});

});

describe('account economy (T3)', () => {
  async function flush() {
    for (let i = 0; i < 50; i += 1) {
      await Promise.resolve();
    }
  }

  it('loads persisted economy into welcome for an account join', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit('u1', { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 });
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await flush();
    const welcome = welcomeOf(peer);
    expect(welcome.economy).toEqual({ coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 });
  });

  it('credits mini-cube coins + click on valid explode and broadcasts economyUpdate to joined account connections', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const first = h.connect('u1', 'alice');
    h.join(first);
    const second = h.connect('u1', 'alice');
    h.join(second);
    await flush();
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    await settleEconomy(h);

    const expected = { type: 'economyUpdate', coins: COINS_PER_MINI_CUBE, clicks: 1, facesDestroyed: 0, cubesDestroyed: 0 };
    // round coins to 2 decimals already
    expect(onlyType(first, 'economyUpdate')).toEqual(expected);
    expect(onlyType(second, 'economyUpdate')).toEqual(expected);
  });

  it('increments facesDestroyed when an explode clears a face', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await flush();
    peer.clear();

    // remove all other ids of front face first, leaving front:2:2
    const ids = allIds(3).filter((id) => id.startsWith('front:'));
    // remove all front ids except last
    for (const id of ids.slice(0, ids.length - 1)) {
      explode(peer, id);
    }
    await flush();
    peer.clear();

    const last = ids[ids.length - 1]!;
    explode(peer, last);
    await settleEconomy(h);

    const update = onlyType(peer, 'economyUpdate');
    expect(update.facesDestroyed).toBe(1);
    expect(update.clicks).toBe(ids.length);
  });

  it('credits completion with speed bonus when fast', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await flush();
    // remove all cubes
    removeLevel(h, peer, allIds(3));
    await flush();
    peer.clear();

    h.setNow(0); // within threshold (grid 3 -> 15s = 15000ms); elapsed 0
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    await settleEconomy(h);

    const update = onlyType(peer, 'economyUpdate');
    expect(update.coins).toBe(roundCoins(54 * COINS_PER_MINI_CUBE + COINS_PER_CUBE * 2));
    expect(update.cubesDestroyed).toBe(1);
  });

  it('credits completion without speed bonus when slow', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await flush();
    removeLevel(h, peer, allIds(3));
    await flush();
    peer.clear();

    h.setNow(100_000); // elapsed large
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    await settleEconomy(h);

    const update = onlyType(peer, 'economyUpdate');
    expect(update.coins).toBe(roundCoins(54 * COINS_PER_MINI_CUBE + COINS_PER_CUBE));
  });

  it('guest join does not call repo or broadcast economyUpdate', async () => {
    const repo = new InMemoryEconomyRepository();
    const spy = vi.spyOn(repo, 'credit');
    const config = loadGameConfig({});
    const clock = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => () => 0,
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      economy: repo,
    });
    const peer = new FakePeer();
    hub.attach(peer); // no account session -> guest
    peer.receive(JSON.stringify({ type: 'join' }));
    await flush();
    peer.clear();
    explode(peer, 'front:0:0');
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(peer.messages().some((m) => m.type === 'economyUpdate')).toBe(false);
  });

  it('boundary: exactly at threshold qualifies for speed bonus', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await flush();
    removeLevel(h, peer, allIds(3));
    await flush();
    peer.clear();

    // cubeStartedAtMs = 0 (join at clock 0). set now to threshold ms.
    const thresholdMs = thresholdSeconds(3) * 1000;
    h.setNow(thresholdMs);
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    await settleEconomy(h);

    const update = onlyType(peer, 'economyUpdate');
    expect(update.coins).toBe(roundCoins(54 * COINS_PER_MINI_CUBE + COINS_PER_CUBE * 2));
  });
});

describe('idle accrual (T4)', () => {
  interface IdleHarness {
    repo: InMemoryEconomyRepository;
    config: GameConfig;
    hub: GameHub;
    setNow: (ms: number) => void;
    connect: (userId?: string, username?: string) => FakePeer;
    join: (peer: FakePeer, mode?: 'account' | 'guest') => void;
    flush: () => Promise<void>;
  }

  function createIdleHarness(): IdleHarness {
    const config = loadGameConfig({});
    let clock = 0;
    const repo = new InMemoryEconomyRepository({ now: () => clock });
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => () => 0,
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      economy: repo,
    });
    return {
      repo,
      config,
      hub,
      setNow: (ms: number) => {
        clock = ms;
      },
      connect: (userId = 'u1', username = 'alice') => {
        const peer = new FakePeer();
        hub.attach(peer, { userId, username, verified: true });
        return peer;
      },
      join: (peer: FakePeer, mode?: 'account' | 'guest') => {
        peer.receive(JSON.stringify(mode ? { type: 'join', mode } : { type: 'join' }));
      },
      flush: async () => {
        for (let i = 0; i < 50; i += 1) {
          await Promise.resolve();
        }
      },
    };
  }

  it('credits idle coins on account join when away long enough', async () => {
    const h = createIdleHarness();
    await h.repo.credit('u1', { coins: 5 });
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(120_000);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const welcome = welcomeOf(peer);
    const expectedCoins = roundCoins(5 + idleCoins(120_000, {}));
    expect(welcome.economy.coins).toBe(expectedCoins);
    expect(welcome.economy.clicks).toBe(0);
    expect(welcome.economy.facesDestroyed).toBe(0);
    expect(welcome.economy.cubesDestroyed).toBe(0);
    const stored = await h.repo.findByUserId('u1');
    expect(stored!.coins).toBe(expectedCoins);
    expect(await h.repo.findLastSeenAt('u1')).toBe(120_000);
    const eu = onlyType(peer, 'economyUpdate');
    expect(eu.coins).toBe(expectedCoins);
  });

  it('does not accrue when away less than threshold', async () => {
    const h = createIdleHarness();
    await h.repo.credit('u1', { coins: 5 });
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(30_000);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const welcome = welcomeOf(peer);
    expect(welcome.economy.coins).toBe(5);
    const eu = peer.messages().find((m) => m.type === 'economyUpdate');
    expect(eu).toBeUndefined();
    expect(await h.repo.findLastSeenAt('u1')).toBe(30_000);
  });

  it('caps accrual at IDLE_CAP_MS', async () => {
    const h = createIdleHarness();
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(IDLE_CAP_MS + 100_000);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const welcome = welcomeOf(peer);
    expect(welcome.economy.coins).toBe(idleCoins(IDLE_CAP_MS, {}));
    expect(idleCoins(IDLE_CAP_MS + 100_000, {})).toBe(idleCoins(IDLE_CAP_MS, {}));
  });

  it('applies mini-cube upgrade multiplier to idle accrual', async () => {
    const h = createIdleHarness();
    await h.repo.credit('u1', { coins: 10 });
    await h.repo.purchaseUpgrade('u1', 'mini_cube_value', 10, 0);
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(60_000);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const welcome = welcomeOf(peer);
    expect(welcome.economy.coins).toBe(idleCoins(60_000, { mini_cube_value: 1 }));
  });

  it('guest join performs no touch or accrual and welcome economy is zero', async () => {
    const h = createIdleHarness();
    const spy = vi.spyOn(h.repo, 'touchLastSeen');
    const peer = new FakePeer();
    h.hub.attach(peer);
    peer.receive(JSON.stringify({ type: 'join', mode: 'guest' }));
    await h.flush();
    const welcome = welcomeOf(peer);
    expect(welcome.economy).toEqual({ coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });
    expect(spy).not.toHaveBeenCalled();
    expect(peer.messages().some((m) => m.type === 'economyUpdate')).toBe(false);
  });

  it('touches last_seen_at on final disconnect', async () => {
    const h = createIdleHarness();
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(0);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    h.setNow(1000);
    peer.drop();
    await h.flush();
    expect(await h.repo.findLastSeenAt('u1')).toBe(1000);
  });

  it('does not touch last_seen_at when another connection remains active', async () => {
    const h = createIdleHarness();
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(0);
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    await h.flush();
    h.setNow(1000);
    first.drop();
    await h.flush();
    expect(await h.repo.findLastSeenAt('u1')).toBe(0);
  });

  it('grace expiry does not touch last_seen_at', async () => {
    const h = createIdleHarness();
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(0);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const spy = vi.spyOn(h.repo, 'touchLastSeen');
    h.setNow(0);
    peer.drop();
    await h.flush();
    const afterClose = spy.mock.calls.length;
    h.setNow(h.config.reconnectGraceMs);
    vi.advanceTimersByTime(h.config.reconnectGraceMs);
    await h.flush();
    expect(spy.mock.calls.length).toBe(afterClose);
  });

  it('rejoin within grace does not touch last_seen_at', async () => {
    const h = createIdleHarness();
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(0);
    const first = h.connect();
    h.join(first);
    await h.flush();
    const token = welcomeOf(first).token;
    first.drop();
    await h.flush();
    const before = await h.repo.findLastSeenAt('u1');
    const spy = vi.spyOn(h.repo, 'touchLastSeen');
    h.setNow(10);
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));
    await h.flush();
    expect(spy).not.toHaveBeenCalled();
    expect(await h.repo.findLastSeenAt('u1')).toBe(before);
  });

  it('concurrent joins credit idle coins only once', async () => {
    const h = createIdleHarness();
    await h.repo.touchLastSeen('u1', 0, null);
    h.setNow(120_000);
    const p1 = h.connect();
    const p2 = h.connect();
    p1.receive(JSON.stringify({ type: 'join' }));
    p2.receive(JSON.stringify({ type: 'join' }));
    await h.flush();
    const expected = idleCoins(120_000, {});
    expect((await h.repo.findByUserId('u1'))!.coins).toBe(expected);
  });
});

describe('granular spaceship customization (T5)', () => {
  function createCustomHarness(repo: InMemoryEconomyRepository, draw: () => number = () => 0) {
    const config = loadGameConfig({});
    let clock = 0;
    let randomFactories = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => {
        randomFactories += 1;
        return draw;
      },
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      economy: repo,
    });
    return {
      config,
      hub,
      randomFactories: () => randomFactories,
      clock: () => clock,
      setNow: (ms: number) => {
        clock = ms;
      },
      advance: (ms: number) => {
        clock += ms;
        vi.advanceTimersByTime(ms);
      },
      advanceTimersOnly: (ms: number) => {
        vi.advanceTimersByTime(ms);
      },
      connect: (userId = 'u1', username = 'alice') => {
        const peer = new FakePeer();
        hub.attach(peer, { userId, username, verified: true });
        return peer;
      },
      connectGuest: () => {
        const peer = new FakePeer();
        hub.attach(peer);
        return peer;
      },
      join: (peer: FakePeer, mode?: 'account' | 'guest') => {
        peer.receive(JSON.stringify(mode ? { type: 'join', mode } : { type: 'join' }));
      },
      flush: async () => {
        for (let i = 0; i < 50; i += 1) {
          await Promise.resolve();
        }
      },
    };
  }

  /** A repository that can hold open calls at a gate, or fail the next open. */
  class GatedEconomyRepository extends InMemoryEconomyRepository {
    gate: Promise<void> | null = null;
    private releaseGate: (() => void) | null = null;
    openCalls = 0;
    failNextOpen = false;

    hold(): void {
      this.gate = new Promise<void>((resolve) => {
        this.releaseGate = resolve;
      });
    }

    release(): void {
      this.releaseGate?.();
      this.releaseGate = null;
      this.gate = null;
    }

    override async applyLootboxOpenV2(
      userId: string,
      partId: PartIdV2,
    ): Promise<
      | { state: CustomizationState; duplicate: boolean }
      | { reason: 'no_lootbox' }
      | { reason: 'no_key' }
    > {
      this.openCalls += 1;
      if (this.failNextOpen) {
        this.failNextOpen = false;
        throw new Error('repository unavailable');
      }
      if (this.gate !== null) {
        await this.gate;
      }
      return super.applyLootboxOpenV2(userId, partId);
    }
  }

  /** Seeds owned v2 parts by opening lootboxes (counts are consumed, parts accumulate). */
  async function grantParts(repo: InMemoryEconomyRepository, parts: PartIdV2[]): Promise<void> {
    await repo.grantCustomization('u1', { lootboxes: parts.length, keys: parts.length });
    for (const part of parts) {
      await repo.applyLootboxOpenV2('u1', part);
    }
  }

  it('account join loads persisted v2 customization into welcome', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 3 });
    await repo.applyLootboxOpenV2('u1', 'nose-crimson');
    await repo.setSlotAppearance('u1', 'nose', 'nose-crimson');
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    expect(welcomeOf(peer).customization).toEqual({
      lootboxes: 1,
      keys: 2,
      parts: { 'nose-crimson': 1 },
      appearance: { nose: 'nose-crimson' },
    });
  });

  it('grants lootbox+key on cube completion and broadcasts customizationUpdate to joined account connections', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const first = h.connect('u1', 'alice');
    h.join(first);
    const second = h.connect('u1', 'alice');
    h.join(second);
    await h.flush();
    first.clear();
    second.clear();

    removeLevel(h, first, allIds(3));
    await h.flush();
    first.clear();
    second.clear();
    h.setNow(0);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    await h.flush();

    const expected = {
      type: 'customizationUpdate',
      lootboxes: 1,
      keys: 1,
      parts: {},
      appearance: {},
    };
    expect(first.messages()).toContainEqual(expected);
    expect(second.messages()).toContainEqual(expected);
    const stored = await repo.findCustomizationByUserId('u1');
    expect(stored).toEqual({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
  });

  it('guest completion does not broadcast customizationUpdate', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connectGuest();
    h.join(peer, 'guest');
    await h.flush();
    peer.clear();
    removeLevel(h, peer, allIds(3));
    await h.flush();
    peer.clear();
    h.setNow(0);
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    await h.flush();
    expect(peer.messages().some((m) => m.type === 'customizationUpdate')).toBe(false);
  });

  it('scoped broadcast: guest connection receives nothing on account grant', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const accountPeer = h.connect('u1', 'alice');
    h.join(accountPeer);
    const guestPeer = h.connectGuest();
    h.join(guestPeer, 'guest');
    await h.flush();
    accountPeer.clear();
    guestPeer.clear();

    removeLevel(h, accountPeer, allIds(3));
    await h.flush();
    accountPeer.clear();
    guestPeer.clear();
    h.setNow(0);
    accountPeer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    await h.flush();

    expect(accountPeer.messages().some((m) => m.type === 'customizationUpdate')).toBe(true);
    expect(guestPeer.messages().some((m) => m.type === 'customizationUpdate')).toBe(false);
  });

  it('openLootbox consumes the weighted draw, updates state and sends the opener-only reveal', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 1, keys: 1 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages()).toContainEqual({
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
    expect(onlyType(peer, 'lootboxOpened')).toEqual({
      type: 'lootboxOpened',
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: false,
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
  });

  it('openLootbox broadcasts state to every joined account connection but reveals only to the opener', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 1, keys: 1 });
    const h = createCustomHarness(repo);
    const first = h.connect('u1', 'alice');
    h.join(first);
    const second = h.connect('u1', 'alice');
    h.join(second);
    const guest = h.connectGuest();
    h.join(guest, 'guest');
    await h.flush();
    first.clear();
    second.clear();
    guest.clear();

    first.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    const expected = {
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    };
    expect(first.messages()).toContainEqual(expected);
    expect(second.messages()).toContainEqual(expected);
    expect(onlyType(first, 'lootboxOpened').partId).toBe('hull-obsidian');
    expect(second.messages().some((m) => m.type === 'lootboxOpened')).toBe(false);
    expect(guest.messages()).toEqual([]);
  });

  it('seeded draws consume the captured hub RNG in order and grant different parts', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    const draws = [0.25, 0, 0.999999];
    let index = 0;
    const draw = () => draws[index++] ?? 0;
    const h = createCustomHarness(repo, draw);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    // The join consumed the first draw: N = 3 + floor(0.25 * 5) = 4.
    expect(welcomeOf(peer).self.gridSize).toBe(4);
    peer.clear();

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages().filter((m) => m.type === 'lootboxOpened')).toEqual([
      {
        type: 'lootboxOpened',
        partId: 'hull-obsidian',
        slot: 'hull',
        rarity: 'rare',
        duplicate: false,
        lootboxes: 1,
        keys: 1,
        parts: { 'hull-obsidian': 1 },
        appearance: {},
      },
      {
        type: 'lootboxOpened',
        partId: 'shot-kite-solar',
        slot: 'shot',
        rarity: 'epic',
        duplicate: false,
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-obsidian': 1, 'shot-kite-solar': 1 },
        appearance: {},
      },
    ]);
    // One captured RNG, never a fresh deps.random() per open (F21).
    expect(h.randomFactories()).toBe(1);
  });

  it('openLootbox with no lootbox sends no_lootbox and no state change', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { keys: 1 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'no_lootbox' }]);
    const stored = await repo.findCustomizationByUserId('u1');
    expect(stored).toEqual({ lootboxes: 0, keys: 1, parts: {}, appearance: {} });
  });

  it('openLootbox with no key sends no_key and no state change', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 1 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'no_key' }]);
    const stored = await repo.findCustomizationByUserId('u1');
    expect(stored).toEqual({ lootboxes: 1, keys: 0, parts: {}, appearance: {} });
  });

  it('openLootbox with zero of both sends no_lootbox first', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'no_lootbox' }]);
  });

  it('guest openLootbox is a no-op on server (no broadcast/error)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connectGuest();
    h.join(peer, 'guest');
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages()).toHaveLength(0);
  });

  it('drops a second open from the same member while the first awaits the repository', async () => {
    const repo = new GatedEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    repo.hold();
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    expect(repo.openCalls).toBe(1);

    repo.release();
    await h.flush();

    expect(peer.messages().filter((m) => m.type === 'customizationUpdate')).toHaveLength(1);
    expect(onlyType(peer, 'lootboxOpened').partId).toBe('hull-obsidian');
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
  });

  it('releases the in-flight guard after a repository exception', async () => {
    const repo = new GatedEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    repo.failNextOpen = true;
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    expect(peer.messages()).toEqual([]);

    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    expect(onlyType(peer, 'lootboxOpened').partId).toBe('hull-obsidian');
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
  });

  it('lets independent account connections open concurrently', async () => {
    const repo = new GatedEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    const h = createCustomHarness(repo);
    const first = h.connect('u1', 'alice');
    h.join(first);
    const second = h.connect('u1', 'alice');
    h.join(second);
    await h.flush();
    first.clear();
    second.clear();

    repo.hold();
    first.receive(JSON.stringify({ type: 'openLootbox' }));
    second.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    expect(repo.openCalls).toBe(2);

    repo.release();
    await h.flush();

    expect(first.messages().filter((m) => m.type === 'lootboxOpened')).toHaveLength(1);
    expect(second.messages().filter((m) => m.type === 'lootboxOpened')).toHaveLength(1);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 2 },
      appearance: {},
    });
  });

  it('allows equipping a standard v2 part without it appearing in parts (AC-12)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'wing-left-default' }));
    await h.flush();

    expect(peer.messages()).toEqual([
      {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: {},
        appearance: { 'wing-left': 'wing-left-default' },
      },
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { 'wing-left': 'wing-left-default' },
      },
    ]);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { 'wing-left': 'wing-left-default' },
    });
  });

  it('equips an owned v2 part through setSlotAppearance and broadcasts one update', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['nose-crimson']);
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-crimson' }));
    await h.flush();

    expect(peer.messages()).toEqual([
      {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: { 'nose-crimson': 1 },
        appearance: { nose: 'nose-crimson' },
      },
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { nose: 'nose-crimson' },
      },
    ]);
  });

  it('equipPart broadcasts to all joined account connections', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['nose-crimson']);
    const h = createCustomHarness(repo);
    const first = h.connect('u1', 'alice');
    h.join(first);
    const second = h.connect('u1', 'alice');
    h.join(second);
    await h.flush();
    first.clear();
    second.clear();

    first.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-crimson' }));
    await h.flush();

    const expected = {
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1 },
      appearance: { nose: 'nose-crimson' },
    };
    // Same-server two tabs are two members: one public frame per affected playerId, so each
    // tab receives both frames (a single frame would leave the sibling's roster entry stale).
    expect(first.messages()).toEqual([
      expected,
      { type: 'memberAppearance', playerId: 'p1', appearance: { nose: 'nose-crimson' } },
      { type: 'memberAppearance', playerId: 'p2', appearance: { nose: 'nose-crimson' } },
    ]);
    expect(second.messages()).toEqual([
      expected,
      { type: 'memberAppearance', playerId: 'p1', appearance: { nose: 'nose-crimson' } },
      { type: 'memberAppearance', playerId: 'p2', appearance: { nose: 'nose-crimson' } },
    ]);
  });

  it('equipPart unknown part sends unknown_part', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'nope' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'unknown_part' }]);
  });

  it('equipPart unowned v2 part sends not_owned', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-emerald' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_owned' }]);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('maps body-gold to hull-gold when the hull part is owned', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['hull-gold']);
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'body-gold' }));
    await h.flush();

    expect(peer.messages()).toEqual([
      {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-gold': 1 },
        appearance: { hull: 'hull-gold' },
      },
      { type: 'memberAppearance', playerId: 'p1', appearance: { hull: 'hull-gold' } },
    ]);
  });

  it('rejects an unowned legacy body id with not_owned', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'body-gold' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_owned' }]);
  });

  it('expands wings-silver to both wings when both v2 parts are owned', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['wing-left-silver', 'wing-right-silver']);
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'wings-silver' }));
    await h.flush();

    expect(peer.messages()).toEqual([
      {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: { 'wing-left-silver': 1, 'wing-right-silver': 1 },
        appearance: { 'wing-left': 'wing-left-silver', 'wing-right': 'wing-right-silver' },
      },
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { 'wing-left': 'wing-left-silver', 'wing-right': 'wing-right-silver' },
      },
    ]);
  });

  it('rejects wings-silver when only one wing is owned (all-or-nothing)', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['wing-left-silver']);
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'wings-silver' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_owned' }]);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'wing-left-silver': 1 },
      appearance: {},
    });
  });

  it('expands engine-blue to both ignitions when both v2 parts are owned', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['ignition-left-blue', 'ignition-right-blue']);
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'engine-blue' }));
    await h.flush();

    expect(peer.messages()).toEqual([
      {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: { 'ignition-left-blue': 1, 'ignition-right-blue': 1 },
        appearance: {
          'ignition-left': 'ignition-left-blue',
          'ignition-right': 'ignition-right-blue',
        },
      },
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: {
          'ignition-left': 'ignition-left-blue',
          'ignition-right': 'ignition-right-blue',
        },
      },
    ]);
  });

  it('rejects engine-blue when only one ignition is owned (all-or-nothing)', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['ignition-right-blue']);
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'engine-blue' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_owned' }]);
  });

  it('expands a standard legacy pair id to both slots without ownership', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'engine-default' }));
    await h.flush();

    expect(peer.messages()).toEqual([
      {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: {},
        appearance: {
          'ignition-left': 'ignition-left-default',
          'ignition-right': 'ignition-right-default',
        },
      },
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: {
          'ignition-left': 'ignition-left-default',
          'ignition-right': 'ignition-right-default',
        },
      },
    ]);
  });

  it('re-equipping the already equipped part is a no-op (no write, no broadcast)', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['nose-crimson']);
    await repo.setSlotAppearance('u1', 'nose', 'nose-crimson');
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();
    const write = vi.spyOn(repo, 'setSlotAppearance');

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-crimson' }));
    await h.flush();

    expect(peer.messages()).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    expect((await repo.findCustomizationByUserId('u1')).appearance).toEqual({
      nose: 'nose-crimson',
    });
    write.mockRestore();
  });

  it('unequipPart deletes one slot and broadcasts to every account connection', async () => {
    const repo = new InMemoryEconomyRepository();
    await grantParts(repo, ['nose-crimson', 'hull-obsidian']);
    await repo.setSlotAppearance('u1', 'nose', 'nose-crimson');
    await repo.setSlotAppearance('u1', 'hull', 'hull-obsidian');
    const h = createCustomHarness(repo);
    const first = h.connect('u1', 'alice');
    h.join(first);
    const second = h.connect('u1', 'alice');
    h.join(second);
    await h.flush();
    first.clear();
    second.clear();

    first.receive(JSON.stringify({ type: 'unequipPart', slotId: 'nose' }));
    await h.flush();

    const expected = {
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'hull-obsidian': 1 },
      appearance: { hull: 'hull-obsidian' },
    };
    const expectedFrames = [
      expected,
      { type: 'memberAppearance', playerId: 'p1', appearance: { hull: 'hull-obsidian' } },
      { type: 'memberAppearance', playerId: 'p2', appearance: { hull: 'hull-obsidian' } },
    ];
    expect(first.messages()).toEqual(expectedFrames);
    expect(second.messages()).toEqual(expectedFrames);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'hull-obsidian': 1 },
      appearance: { hull: 'hull-obsidian' },
    });
  });

  it('unequipPart unknown slot sends unknown_slot', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'unequipPart', slotId: 'wings' }));
    await h.flush();

    expect(peer.messages()).toEqual([{ type: 'error', code: 'unknown_slot' }]);
  });

  it('unequip of an already-default slot is a no-op', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();
    const write = vi.spyOn(repo, 'setSlotAppearance');

    peer.receive(JSON.stringify({ type: 'unequipPart', slotId: 'hull' }));
    await h.flush();

    expect(peer.messages()).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it('unequip of a slot explicitly set to its standard part is a no-op', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setSlotAppearance('u1', 'hull', 'hull-default');
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'unequipPart', slotId: 'hull' }));
    await h.flush();

    expect(peer.messages()).toEqual([]);
    expect((await repo.findCustomizationByUserId('u1')).appearance).toEqual({
      hull: 'hull-default',
    });
  });

  it('welcome carries customization for account (worldEntered inclusion via placement)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 5, keys: 2 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const welcome = welcomeOf(peer);
    expect(welcome.customization).toEqual({ lootboxes: 5, keys: 2, parts: {}, appearance: {} });
  });

  it('guest join welcome has no customization', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createCustomHarness(repo);
    const peer = h.connectGuest();
    h.join(peer, 'guest');
    await h.flush();
    const welcome = welcomeOf(peer);
    expect(welcome.customization).toBeUndefined();
  });

  it('rejoin within grace returns the persisted v2 customization and no reveal', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 1, keys: 1 });
    const h = createCustomHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await h.flush();
    const token = welcomeOf(peer).token;
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    peer.drop();
    await h.flush();

    const peer2 = new FakePeer();
    h.hub.attach(peer2, { userId: 'u1', username: 'alice', verified: true });
    peer2.receive(JSON.stringify({ type: 'rejoin', token }));
    await h.flush();

    const welcome = welcomeOf(peer2);
    expect(welcome.customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
    expect(peer2.messages().some((m) => m.type === 'lootboxOpened')).toBe(false);
  });
});

describe('public appearance projection (remote-spaceship-customization T6)', () => {
  /**
   * The worst-case 11-entry appearance: every slot with its longest catalog id
   * (`<slot>-bulwark-crimson`; the longest is `ignition-right-bulwark-crimson`, 30 chars).
   */
  const FULL_APPEARANCE: Record<string, string> = {
    hull: 'hull-bulwark-crimson',
    nose: 'nose-bulwark-crimson',
    cockpit: 'cockpit-bulwark-crimson',
    'wing-left': 'wing-left-bulwark-crimson',
    'wing-right': 'wing-right-bulwark-crimson',
    'engine-left': 'engine-left-bulwark-crimson',
    'engine-right': 'engine-right-bulwark-crimson',
    'ignition-left': 'ignition-left-bulwark-crimson',
    'ignition-right': 'ignition-right-bulwark-crimson',
    'tail-fin': 'tail-fin-bulwark-crimson',
    shot: 'shot-bulwark-crimson',
  };

  /** The public `MemberState` key set: identity/cube/appearance only (no inventory/account). */
  const PUBLIC_MEMBER_KEYS = [
    'appearance',
    'gridSize',
    'levelIndex',
    'name',
    'pitchSteps',
    'playerId',
    'position',
    'removedIds',
    'styleId',
    'yawSteps',
  ];

  interface AppearanceHarnessOptions {
    overrides?: Partial<GameConfig>;
    economy?: InMemoryEconomyRepository;
    draw?: () => number;
  }

  /** A hub with a manual clock, optional repo/metrics and guest/account helpers. */
  function createAppearanceHarness(options: AppearanceHarnessOptions = {}) {
    const config: GameConfig = { ...loadGameConfig({}), ...options.overrides };
    const metrics = createMetrics();
    let clock = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => options.draw ?? (() => 0),
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      metrics,
      ...(options.economy === undefined ? {} : { economy: options.economy }),
    });
    return {
      config,
      hub,
      metrics,
      setNow(ms: number): void {
        clock = ms;
      },
      advance(ms: number): void {
        clock += ms;
        vi.advanceTimersByTime(ms);
      },
      connectGuest(): FakePeer {
        const peer = new FakePeer();
        hub.attach(peer);
        return peer;
      },
      advanceTimersOnly(ms: number): void {
        vi.advanceTimersByTime(ms);
      },
      connectAccount(userId = 'u1', username = 'alice'): FakePeer {
        const peer = new FakePeer();
        hub.attach(peer, { userId, username, verified: true });
        return peer;
      },
      join(peer: FakePeer): void {
        peer.receive(JSON.stringify({ type: 'join' }));
      },
      rejoin(peer: FakePeer, token: string): void {
        peer.receive(JSON.stringify({ type: 'rejoin', token }));
      },
      setAppearance(peer: FakePeer, appearance: Record<string, string>): void {
        peer.receive(JSON.stringify({ type: 'setAppearance', appearance }));
      },
      async flush(): Promise<void> {
        await drainMicrotasks();
      },
    };
  }

  /** The numeric value of one exact rendered sample (`name` or `name{labels}`), or `null`. */
  function sampleValue(metrics: Metrics, sample: string): number | null {
    const line = metrics
      .render()
      .split('\n')
      .find((candidate) => candidate.startsWith(`${sample} `));
    if (line === undefined) {
      return null;
    }
    return Number(line.slice(sample.length + 1));
  }

  /** A repository with the pinned seeded appearance and an owned lootable nose part. */
  async function seededRepository(): Promise<InMemoryEconomyRepository> {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    await repo.applyLootboxOpenV2('u1', 'nose-crimson');
    await repo.applyLootboxOpenV2('u1', 'hull-dart-chrome');
    await repo.setSlotAppearance('u1', 'hull', 'hull-obsidian');
    return repo;
  }

  it('seeds an account member from the persisted v3 appearance on a fresh join', async () => {
    const repo = await seededRepository();
    await repo.setSlotAppearance('u1', 'shot', 'shot-orca-violet');
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const peer = h.connectAccount();
    h.join(peer);
    await h.flush();

    const welcome = welcomeOf(peer);
    expect(welcome.roster).toEqual([
      memberOf('p1', 'alice', X2_SLOT_1, LEVEL_0, 0, 0, {
        hull: 'hull-obsidian',
        shot: 'shot-orca-violet',
      }),
    ]);
    expect(welcome.roster[0]!.appearance).toEqual({
      hull: 'hull-obsidian',
      shot: 'shot-orca-violet',
    });
    // The account-private persisted state keeps the same normalized record.
    expect(welcome.customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'hull-dart-chrome': 1 },
      appearance: { hull: 'hull-obsidian', shot: 'shot-orca-violet' },
    });
  });

  it('seeds a sibling tab memberJoined with the persisted appearance', async () => {
    const repo = await seededRepository();
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const first = h.connectAccount();
    h.join(first);
    await h.flush();
    const second = h.connectAccount();
    h.join(second);
    await h.flush();

    expect(onlyType(first, 'memberJoined')).toEqual({
      type: 'memberJoined',
      member: memberOf('p2', 'alice', X2_SLOT_2, LEVEL_0, 0, 0, { hull: 'hull-obsidian' }),
    });
    expect(welcomeOf(second).roster).toEqual([
      memberOf('p1', 'alice', X2_SLOT_1, LEVEL_0, 0, 0, { hull: 'hull-obsidian' }),
      memberOf('p2', 'alice', X2_SLOT_2, LEVEL_0, 0, 0, { hull: 'hull-obsidian' }),
    ]);
  });

  it('keeps the seeded account appearance across a rejoin inside grace', async () => {
    const repo = await seededRepository();
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const peer = h.connectAccount();
    h.join(peer);
    await h.flush();
    const token = welcomeOf(peer).token;
    peer.drop();

    const resumed = new FakePeer();
    h.hub.attach(resumed, { userId: 'u1', username: 'alice', verified: true });
    h.rejoin(resumed, token);
    await h.flush();

    expect(welcomeOf(resumed).roster).toEqual([
      memberOf('p1', 'alice', X2_SLOT_1, LEVEL_0, 0, 0, { hull: 'hull-obsidian' }),
    ]);
  });

  it('starts every guest from an empty appearance on welcome and memberJoined', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);

    expect(welcomeOf(first).roster).toEqual([memberOf('p1', 'Player 1', X2_SLOT_1)]);
    expect(welcomeOf(second).roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    expect(onlyType(first, 'memberJoined')).toEqual({
      type: 'memberJoined',
      member: memberOf('p2', 'Player 2', X2_SLOT_2),
    });
  });

  it('normalizes a guest report, stores it and broadcasts only to the other members', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 3 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    first.clear();
    second.clear();

    // A wrong-slot id, an unknown id and a valid id: only the valid one survives normalization.
    h.setAppearance(first, {
      hull: 'nose-crimson',
      nose: 'nope',
      'wing-left': 'wing-left-gold',
    });

    expect(second.messages()).toEqual([
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { 'wing-left': 'wing-left-gold' },
      },
    ]);
    // The origin is excluded from its own report.
    expect(first.messages()).toEqual([]);

    // The pinned record is what later joiners see in the roster.
    const third = h.connectGuest();
    h.join(third);
    expect(welcomeOf(third).roster).toEqual([
      memberOf('p1', 'Player 1', X3_SLOT_1, LEVEL_0, 0, 0, {
        'wing-left': 'wing-left-gold',
      }),
      memberOf('p2', 'Player 2', X3_SLOT_2),
      memberOf('p3', 'Player 3', X3_SLOT_3),
    ]);
  });

  it('broadcasts nothing when a guest report normalizes to the stored record', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    first.clear();
    second.clear();
    h.setAppearance(first, { hull: 'hull-gold' });
    expect(second.messages()).toEqual([
      { type: 'memberAppearance', playerId: 'p1', appearance: { hull: 'hull-gold' } },
    ]);
    first.clear();
    second.clear();

    // The legacy part id normalizes to the same canonical record: no state change, no frame.
    h.setAppearance(first, { hull: 'body-gold' });
    expect(second.messages()).toEqual([]);
    expect(first.messages()).toEqual([]);
  });

  it('notifies the stored change when a guest report normalizes to an empty record', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    h.setAppearance(first, { nose: 'nose-crimson' });
    first.clear();
    second.clear();

    h.setAppearance(first, { nose: 'missing-part' });
    expect(second.messages()).toEqual([
      { type: 'memberAppearance', playerId: 'p1', appearance: {} },
    ]);
    expect(first.messages()).toEqual([]);
  });

  it('treats setAppearance from an account member as a silent no-op', async () => {
    const repo = await seededRepository();
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const peer = h.connectAccount();
    h.join(peer);
    await h.flush();
    peer.clear();

    h.setAppearance(peer, { nose: 'nose-crimson' });
    await h.flush();
    expect(peer.messages()).toEqual([]);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'hull-dart-chrome': 1 },
      appearance: { hull: 'hull-obsidian' },
    });

    // A sibling tab still sees the persisted record, and the next accepted equip builds on it
    // (the refused report was never stored).
    const second = h.connectAccount();
    h.join(second);
    await h.flush();
    expect(welcomeOf(second).roster[0]!.appearance).toEqual({ hull: 'hull-obsidian' });
    peer.clear();
    second.clear();
    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-crimson' }));
    await h.flush();
    // Both members of the account are affected: one frame per playerId on this server.
    expect(
      peer.messages().filter((message) => message.type === 'memberAppearance'),
    ).toEqual([
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
      {
        type: 'memberAppearance',
        playerId: 'p2',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
    ]);
  });

  it('fans out one public frame per member for two tabs on the same server', async () => {
    const repo = await seededRepository();
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 3 } });
    const first = h.connectAccount();
    h.join(first);
    await h.flush();
    const second = h.connectAccount();
    h.join(second);
    await h.flush();
    const guest = h.connectGuest();
    h.join(guest);
    await h.flush();
    first.clear();
    second.clear();
    guest.clear();

    first.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-crimson' }));
    await h.flush();

    const update = {
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'hull-dart-chrome': 1 },
      appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
    };
    const frames = [
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
      {
        type: 'memberAppearance',
        playerId: 'p2',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
    ] as const;

    // Both tabs are members ⇒ two frames per server, one per affected playerId.
    expect(first.messages()).toEqual([update, ...frames]);
    expect(second.messages()).toEqual([update, ...frames]);
    // The guest is not on the account: it receives only the public projection.
    expect(guest.messages()).toEqual([...frames]);
  });

  it('fans out one public frame per server when the account has a tab on each', async () => {
    const repo = await seededRepository();
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const first = h.connectAccount();
    h.join(first);
    await h.flush();
    const guest = h.connectGuest();
    h.join(guest);
    const second = h.connectAccount();
    h.join(second);
    await h.flush();
    expect(welcomeOf(first).serverId).toBe(1);
    expect(welcomeOf(guest).serverId).toBe(1);
    expect(welcomeOf(second).serverId).toBe(2);
    first.clear();
    guest.clear();
    second.clear();

    first.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-crimson' }));
    await h.flush();

    const update = {
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'hull-dart-chrome': 1 },
      appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
    };
    // Server 1 owns p1's frame; server 2 owns p3's frame. One frame each, never cross-server.
    expect(first.messages()).toEqual([
      update,
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
    ]);
    expect(guest.messages()).toEqual([
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
    ]);
    expect(second.messages()).toEqual([
      update,
      {
        type: 'memberAppearance',
        playerId: 'p3',
        appearance: { hull: 'hull-obsidian', nose: 'nose-crimson' },
      },
    ]);
  });

  it('accepts generated v3 parts, the shot slot and their unequip through the account path', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    await repo.applyLootboxOpenV2('u1', 'hull-dart-chrome');
    await repo.applyLootboxOpenV2('u1', 'shot-orca-violet');
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const peer = h.connectAccount();
    h.join(peer);
    await h.flush();
    peer.clear();

    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'hull-dart-chrome' }));
    await h.flush();
    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'shot-orca-violet' }));
    await h.flush();
    peer.receive(JSON.stringify({ type: 'unequipPart', slotId: 'shot' }));
    await h.flush();

    expect(
      peer.messages().filter((message) => message.type === 'memberAppearance'),
    ).toEqual([
      { type: 'memberAppearance', playerId: 'p1', appearance: { hull: 'hull-dart-chrome' } },
      {
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { hull: 'hull-dart-chrome', shot: 'shot-orca-violet' },
      },
      { type: 'memberAppearance', playerId: 'p1', appearance: { hull: 'hull-dart-chrome' } },
    ]);
    expect(await repo.findCustomizationByUserId('u1')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-dart-chrome': 1, 'shot-orca-violet': 1 },
      appearance: { hull: 'hull-dart-chrome' },
    });

    // Accepted rules stay intact for v3: unowned is refused, unknown ids are refused.
    peer.clear();
    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'nose-kite-solar' }));
    await h.flush();
    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_owned' }]);
    peer.clear();
    peer.receive(JSON.stringify({ type: 'equipPart', partId: 'hull-not-a-part' }));
    await h.flush();
    expect(peer.messages()).toEqual([{ type: 'error', code: 'unknown_part' }]);
    peer.clear();
    peer.receive(JSON.stringify({ type: 'unequipPart', slotId: 'booster' }));
    await h.flush();
    expect(peer.messages()).toEqual([{ type: 'error', code: 'unknown_slot' }]);
  });

  it('admits 10 guest frames in a true trailing second and expires the first at 1000 ms', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 3 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    first.clear();
    second.clear();

    const finishes = [
      'chrome',
      'azure',
      'ember',
      'jade',
      'steel',
      'ivory',
      'abyss',
      'aurum',
      'violet',
      'crimson',
      'plasma',
      'solar',
    ] as const;
    const record = (finish: string): Record<string, string> => ({
      nose: `nose-dart-${finish}`,
    });

    for (let index = 0; index < 10; index += 1) {
      h.setNow(index * 100);
      h.setAppearance(first, record(finishes[index]!));
    }
    // 10 admitted frames at 0…900: the 11th at 950 sits inside (−50, 950] and is dropped.
    h.setNow(950);
    h.setAppearance(first, record('plasma'));
    expect(second.messages()).toHaveLength(10);
    // At 1000 the frame admitted at 0 is forgotten (`<= now − 1000`), so the next one is admitted.
    h.setNow(1000);
    h.setAppearance(first, record('solar'));
    expect(second.messages()).toHaveLength(11);
    expect(first.messages()).toEqual([]);

    // Dropped frames changed no state: a later joiner sees the 10th record, never the 11th.
    const third = h.connectGuest();
    h.join(third);
    expect(welcomeOf(third).roster[0]!.appearance).toEqual({
      nose: 'nose-dart-solar',
    });
    expect(second.messages().filter((message) => message.type === 'memberAppearance')).toEqual(
      finishes.slice(0, 10).map((finish) => ({
        type: 'memberAppearance',
        playerId: 'p1',
        appearance: { nose: `nose-dart-${finish}` },
      })).concat([
        { type: 'memberAppearance', playerId: 'p1', appearance: { nose: 'nose-dart-solar' } },
      ]),
    );
  });

  it('keeps a guest appearance across a socket close inside grace and a rejoin', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    h.setAppearance(first, FULL_APPEARANCE);
    const token = welcomeOf(first).token;
    second.clear();

    first.drop();
    const resumed = new FakePeer();
    h.hub.attach(resumed);
    h.rejoin(resumed, token);

    expect(welcomeOf(resumed).roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1, LEVEL_0, 0, 0, FULL_APPEARANCE),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    // A resume sends no appearance frame: the roster is the authoritative projection.
    expect(second.messages()).toEqual([]);
  });

  it('discards the appearance on final removal and starts a new identity empty', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const token = welcomeOf(first).token;
    h.setAppearance(first, FULL_APPEARANCE);
    first.drop();
    h.advance(h.config.reconnectGraceMs);

    const late = new FakePeer();
    h.hub.attach(late);
    h.rejoin(late, token);
    expect(onlyType(late, 'error')).toEqual({ type: 'error', code: 'resume_failed' });

    const fresh = h.connectGuest();
    h.join(fresh);
    expect(welcomeOf(fresh).roster).toEqual([memberOf('p2', 'Player 2', X2_SLOT_1)]);
    expect(welcomeOf(fresh).roster[0]!.appearance).toEqual({});
  });

  it('carries the appearance with the member on a cross-server move', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    const third = h.connectGuest();
    h.join(third);
    expect(welcomeOf(first).serverId).toBe(1);
    expect(welcomeOf(second).serverId).toBe(1);
    expect(welcomeOf(third).serverId).toBe(2);
    h.setAppearance(third, FULL_APPEARANCE);
    // No other member shares server 2, so the guest report produces no frame.
    expect(first.messages().some((message) => message.type === 'memberAppearance')).toBe(false);
    expect(second.messages().some((message) => message.type === 'memberAppearance')).toBe(false);

    // Free a server-1 slot so the planned move targets it at completion.
    second.drop();
    h.advance(h.config.reconnectGraceMs);
    first.clear();
    third.clear();

    removeLevel(h, third, allIds(3));
    third.clear();
    first.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const moved = memberOf(
      'p3',
      'Player 3',
      X2_SLOT_2,
      { levelIndex: 1, gridSize: 3, styleId: 'crimson-alloy', removedIds: [] },
      0,
      0,
      FULL_APPEARANCE,
    );
    const entered = onlyType(third, 'worldEntered');
    expect(entered.serverId).toBe(1);
    expect(entered.roster).toEqual([memberOf('p1', 'Player 1', X2_SLOT_1), moved]);
    expect(entered.roster[1]!.appearance).toEqual(FULL_APPEARANCE);
    expect(onlyType(first, 'memberJoined').member).toEqual(moved);
  });

  it('never exposes account identity or inventory on the public member projection', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    await repo.applyLootboxOpenV2('u1', 'hull-gold');
    await repo.applyLootboxOpenV2('u1', 'shot-kite-solar');
    await repo.setSlotAppearance('u1', 'hull', 'hull-dart-chrome');
    const h = createAppearanceHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const guest = h.connectGuest();
    h.join(guest);
    const account = h.connectAccount();
    h.join(account);
    await h.flush();

    const projected = memberOf('p2', 'alice', X2_SLOT_2, LEVEL_0, 0, 0, {
      hull: 'hull-dart-chrome',
    });
    const joined = onlyType(guest, 'memberJoined');
    expect(joined.member).toEqual(projected);
    expect(Object.keys(joined.member).sort()).toEqual(PUBLIC_MEMBER_KEYS);
    expect(welcomeOf(account).roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1),
      projected,
    ]);
    expect(Object.keys(welcomeOf(account).roster[1]!).sort()).toEqual(PUBLIC_MEMBER_KEYS);
  });

  it('counts a metrics-enabled memberAppearance broadcast without throwing', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connectGuest();
    h.join(first);
    const second = h.connectGuest();
    h.join(second);
    second.clear();

    h.setAppearance(first, { nose: 'nose-crimson' });

    expect(second.messages()).toEqual([
      { type: 'memberAppearance', playerId: 'p1', appearance: { nose: 'nose-crimson' } },
    ]);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="setAppearance"}'),
    ).toBe(1);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="memberAppearance"}'),
    ).toBe(1);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="memberAppearance"}'),
    ).toBe(1);
  });

  it('pins the 24-member full-appearance welcome inside the AC-14 outbound budget', async () => {
    const h = createAppearanceHarness({ overrides: { maxUsersPerServer: 24 } });
    const peers: FakePeer[] = [];
    for (let index = 0; index < 24; index += 1) {
      const peer = h.connectGuest();
      h.join(peer);
      peers.push(peer);
    }
    for (const peer of peers) {
      h.setAppearance(peer, FULL_APPEARANCE);
    }
    const last = peers[23]!;
    const token = welcomeOf(last).token;
    last.drop();
    const resumed = new FakePeer();
    h.hub.attach(resumed);
    h.rejoin(resumed, token);

    const welcome = welcomeOf(resumed);
    expect(welcome.roster).toHaveLength(24);
    expect(welcome.customization).toBeUndefined();
    for (const member of welcome.roster) {
      expect(member.removedIds).toEqual([]);
      expect(member.appearance).toEqual(FULL_APPEARANCE);
      expect(Buffer.byteLength(JSON.stringify(member.appearance), 'utf8')).toBeLessThanOrEqual(550);
    }
    expect(Buffer.byteLength(JSON.stringify(welcome), 'utf8')).toBeLessThanOrEqual(17_408);
  });
});

describe('encode-once fan-out (T3-B)', () => {
  it('encodes one removal broadcast once for ten members and fans out identical bytes', () => {
    const harness = createHarness();
    const peers: FakePeer[] = [];
    for (let index = 0; index < 10; index += 1) {
      const peer = harness.connect();
      harness.join(peer);
      peers.push(peer);
    }
    for (const peer of peers) {
      peer.clear();
    }

    const stringify = vi.spyOn(JSON, 'stringify');
    explode(peers[0]!, 'front:0:0');
    explode(peers[0]!, 'front:0:1');
    flushRemovals(harness);

    expect(encodeCallsFor(stringify, 'miniCubesRemoved')).toHaveLength(1);
    const expectedText =
      '{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}';
    for (const peer of peers) {
      expect(peer.sent).toEqual([expectedText]);
    }
  });

  it('encodes one memberLeft broadcast once for ten members', () => {
    const harness = createHarness();
    const peers: FakePeer[] = [];
    for (let index = 0; index < 10; index += 1) {
      const peer = harness.connect();
      harness.join(peer);
      peers.push(peer);
    }
    for (const peer of peers) {
      peer.clear();
    }

    const stringify = vi.spyOn(JSON, 'stringify');
    peers[0]!.drop();
    harness.advance(harness.config.reconnectGraceMs);

    expect(encodeCallsFor(stringify, 'memberLeft')).toHaveLength(1);
    const expectedText = '{"type":"memberLeft","playerId":"p1","reason":"left"}';
    const expectedActivity =
      '{"type":"activityEvent","event":{"id":2,"at":30000,"serverId":1,"type":"memberLeft","playerId":"p1","name":"Player 1"}}';
    for (const peer of peers.slice(1)) {
      expect(sentTextsWithoutLeaderboard(peer)).toEqual([expectedText, expectedActivity]);
    }
    expect(peers[0]!.sent).toEqual([]);
  });

  it('isolates a throwing peer and delivers the frame to every other member (AC-2)', () => {
    const harness = createHarness();
    const peers: FakePeer[] = [];
    for (let index = 0; index < 4; index += 1) {
      const peer = harness.connect();
      harness.join(peer);
      peers.push(peer);
    }
    const throwing = new ThrowingPeer();
    harness.hub.attach(throwing);
    harness.join(throwing);
    for (let index = 0; index < 5; index += 1) {
      const peer = harness.connect();
      harness.join(peer);
      peers.push(peer);
    }
    for (const peer of peers) {
      peer.clear();
    }
    throwing.clear();

    throwing.failNextSend = true;
    explode(peers[0]!, 'front:0:0');
    explode(peers[0]!, 'front:0:1');
    flushRemovals(harness);

    const expected = {
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    };
    for (const peer of peers) {
      expect(peer.messages()).toEqual([expected]);
    }
    expect(throwing.messages()).toEqual([]);
    expect(throwing.closed).toBe(true);
    expect(harness.hub.connectionCount()).toBe(9);
  });

  it('encodes each account message type once for three connections (AC-3)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createAccountHarness(repo);
    const peers = [h.connect(), h.connect(), h.connect()];
    for (const peer of peers) {
      h.join(peer);
    }
    await drainMicrotasks();
    for (const peer of peers) {
      peer.clear();
    }

    const stringify = vi.spyOn(JSON, 'stringify');
    explode(peers[0]!, 'front:0:0');
    await settleEconomy(h);

    expect(encodeCallsFor(stringify, 'economyUpdate')).toHaveLength(1);
    const economyText =
      '{"type":"economyUpdate","coins":100.1,"clicks":1,"facesDestroyed":0,"cubesDestroyed":0}';
    for (const peer of peers) {
      expect(sentTextsOfType(peer, 'economyUpdate')).toEqual([economyText]);
    }
    for (const peer of peers) {
      peer.clear();
    }

    stringify.mockClear();
    peers[0]!.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
    await drainMicrotasks();

    expect(encodeCallsFor(stringify, 'upgradesUpdate')).toHaveLength(1);
    expect(encodeCallsFor(stringify, 'economyUpdate')).toHaveLength(1);
    const upgradesText = '{"type":"upgradesUpdate","upgrades":{"mini_cube_value":1}}';
    const purchaseEconomyText =
      '{"type":"economyUpdate","coins":90.1,"clicks":1,"facesDestroyed":0,"cubesDestroyed":0}';
    for (const peer of peers) {
      expect(sentTextsOfType(peer, 'upgradesUpdate')).toEqual([upgradesText]);
      expect(sentTextsOfType(peer, 'economyUpdate')).toEqual([purchaseEconomyText]);
      peer.clear();
    }

    stringify.mockClear();
    peers[0]!.receive('{"type":"equipPart","partId":"wing-left-default"}');
    await drainMicrotasks();

    expect(encodeCallsFor(stringify, 'customizationUpdate')).toHaveLength(1);
    const customizationText =
      '{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{},"appearance":{"wing-left":"wing-left-default"}}';
    for (const peer of peers) {
      expect(sentTextsOfType(peer, 'customizationUpdate')).toEqual([customizationText]);
    }
  });
});

describe('removal batching (T3-B)', () => {
  it('keeps the legacy frame for one id and batches two ids in acceptance order', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    expect(first.messages()).toEqual([]);
    flushRemovals(harness);
    expect(first.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
    expect(second.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);

    first.clear();
    second.clear();
    explode(first, 'front:0:1');
    explode(first, 'front:0:2');
    flushRemovals(harness);
    expect(first.messages()).toEqual([
      {
        type: 'miniCubesRemoved',
        playerId: 'p1',
        ids: ['front:0:1', 'front:0:2'],
      },
    ]);
    expect(second.messages()).toEqual([
      {
        type: 'miniCubesRemoved',
        playerId: 'p1',
        ids: ['front:0:1', 'front:0:2'],
      },
    ]);
  });

  it('collapses a 30-click burst into one frame bounded by 1024 bytes (AC-10/AC-14)', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    peer.clear();

    const ids = allIds(3).slice(0, 30);
    for (const id of ids) {
      explode(peer, id);
    }
    expect(peer.messages()).toEqual([]);

    flushRemovals(harness);
    expect(peer.messages()).toEqual([
      { type: 'miniCubesRemoved', playerId: 'p1', ids },
    ]);
    expect(Buffer.byteLength(peer.sent[0]!, 'utf8')).toBeLessThanOrEqual(1024);
  });

  it('groups per member in first-enqueue order and never per click', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    const firstIds = allIds(3).slice(0, 3);
    const secondIds = allIds(3).slice(3, 6);
    for (const id of firstIds) {
      explode(first, id);
    }
    for (const id of secondIds) {
      explode(second, id);
    }
    flushRemovals(harness);

    const expected = [
      { type: 'miniCubesRemoved', playerId: 'p1', ids: firstIds },
      { type: 'miniCubesRemoved', playerId: 'p2', ids: secondIds },
    ];
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);
  });

  it('flushes pending removals before levelAdvanced on a completion boundary', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const ids = allIds(3);
    removeLevel(harness, first, ids.slice(0, ids.length - 1));
    first.clear();
    second.clear();

    explode(first, ids[ids.length - 1]!);
    // No timer advance: the completion boundary itself must flush the pending removal first.
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const removal = {
      type: 'miniCubeRemoved',
      playerId: 'p1',
      id: ids[ids.length - 1]!,
    };
    const advanced = {
      type: 'levelAdvanced',
      playerId: 'p1',
      levelIndex: 1,
      gridSize: 3,
      styleId: 'crimson-alloy',
      position: X2_SLOT_1,
      removedIds: [],
    };
    expect(first.messages()).toEqual([
      removal,
      advanced,
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ]);
    expect(second.messages()).toEqual([
      removal,
      advanced,
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ]);
  });

  it('flushes pending removals before memberJoined on a join boundary', () => {
    const harness = createHarness({ maxUsersPerServer: 3 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    const third = harness.connect();
    harness.join(third);

    expect(second.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
      { type: 'memberJoined', member: memberOf('p3', 'Player 3', X3_SLOT_3) },
    ]);
    expect(third.messages().map((message) => message.type)).toEqual(['welcome']);
  });

  it('flushes pending removals before memberLeft on grace finalisation', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const secondToken = welcomeOf(second).token;
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    second.drop();
    harness.setNow(harness.config.reconnectGraceMs);
    const late = harness.connect();
    late.receive(JSON.stringify({ type: 'rejoin', token: secondToken }));

    expect(first.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2'),
    ]);
    expect(late.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);
  });

  it('flushes a mover batch to the old server before the move and never to the new server', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(third).serverId).toBe(2);

    first.drop();
    harness.advance(harness.config.reconnectGraceMs);
    second.clear();
    third.clear();

    const ids = allIds(3);
    removeLevel(harness, third, ids.slice(0, ids.length - 1));
    second.clear();
    third.clear();
    explode(third, ids[ids.length - 1]!);
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(third.messages().map((message) => message.type)).toEqual([
      'miniCubeRemoved',
      'worldEntered',
      'activityEvent',
    ]);
    expect(onlyType(third, 'miniCubeRemoved')).toEqual({
      type: 'miniCubeRemoved',
      playerId: 'p3',
      id: ids[ids.length - 1]!,
    });
    expect(onlyType(third, 'worldEntered').serverId).toBe(1);
    expect(second.messages().map((message) => message.type)).toEqual([
      'memberJoined',
      'activityEvent',
    ]);
  });

  it('does not flush on rotate; a missed batch is recovered from the rejoin welcome (AC-13)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const firstToken = welcomeOf(first).token;
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    first.receive(JSON.stringify({ type: 'rotate', yawSteps: 1, pitchSteps: 0 }));
    expect(second.messages()).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 1, pitchSteps: 0 },
    ]);

    explode(first, 'front:0:1');
    first.drop();
    harness.advance(MINI_CUBE_BATCH_WINDOW_MS);
    expect(second.messages().slice(1)).toEqual([
      {
        type: 'miniCubesRemoved',
        playerId: 'p1',
        ids: ['front:0:0', 'front:0:1'],
      },
    ]);

    const resumed = harness.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token: firstToken }));
    const welcome = welcomeOf(resumed);
    expect(welcome.self.removedIds).toEqual(['front:0:0', 'front:0:1']);
    expect(welcome.roster[0]!.removedIds).toEqual(['front:0:0', 'front:0:1']);
  });
});

describe('economy coalescing and revision ordering (T3-B)', () => {
  it('coalesces thirty accepted clicks into one absolute frame with thirty writes (AC-19)', async () => {
    const repo = new InMemoryEconomyRepository();
    const writes = vi.spyOn(repo, 'creditWithRevision');
    const h = createAccountHarness(repo);
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    await drainMicrotasks();
    first.clear();
    second.clear();

    const ids = allIds(3);
    for (let index = 0; index < 30; index += 1) {
      explode(first, ids[index]!);
    }
    await drainMicrotasks();
    expect(first.messages().filter((message) => message.type === 'economyUpdate')).toEqual([]);

    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    const expected = {
      type: 'economyUpdate',
      coins: 3,
      clicks: 30,
      facesDestroyed: 3,
      cubesDestroyed: 0,
    };
    expect(onlyType(first, 'economyUpdate')).toEqual(expected);
    expect(onlyType(second, 'economyUpdate')).toEqual(expected);
    expect(writes).toHaveBeenCalledTimes(30);
  });

  it('limits automatic economy frames to the 250 ms cadence (AC-20)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    const ids = allIds(3);
    explode(peer, ids[0]!);
    await drainMicrotasks();
    h.advance(100);
    explode(peer, ids[1]!);
    await drainMicrotasks();
    h.advance(150);
    const firstWindow = peer
      .messages()
      .filter((message): message is Extract<ServerMessage, { type: 'economyUpdate' }> =>
        message.type === 'economyUpdate',
      );
    expect(firstWindow).toHaveLength(1);
    expect(firstWindow[0]).toEqual({
      type: 'economyUpdate',
      coins: 0.2,
      clicks: 2,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });

    h.advance(50);
    explode(peer, ids[2]!);
    await drainMicrotasks();
    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    const bothWindows = peer
      .messages()
      .filter((message): message is Extract<ServerMessage, { type: 'economyUpdate' }> =>
        message.type === 'economyUpdate',
      );
    expect(bothWindows).toHaveLength(2);
    expect(bothWindows[1]).toEqual({
      type: 'economyUpdate',
      coins: 0.3,
      clicks: 3,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('keeps the highest-revision totals when an older credit resolves last (AC-29a)', async () => {
    const repo = new DeferredEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    const ids = allIds(3);
    const release = repo.holdNextCredit();
    explode(peer, ids[0]!);
    explode(peer, ids[1]!);
    await drainMicrotasks();
    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    expect(onlyType(peer, 'economyUpdate')).toEqual({
      type: 'economyUpdate',
      coins: 0.2,
      clicks: 2,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });

    release();
    await drainMicrotasks();
    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    expect(peer.messages().filter((message) => message.type === 'economyUpdate')).toHaveLength(1);
    expect(onlyType(peer, 'economyUpdate')).toEqual({
      type: 'economyUpdate',
      coins: 0.2,
      clicks: 2,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
    expect(await repo.findByUserId('u1')).toEqual({
      coins: 0.2,
      clicks: 2,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('flushes a purchase immediately and cancels the automatic window (AC-21)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
    await drainMicrotasks();
    expect(onlyType(peer, 'upgradesUpdate')).toEqual({
      type: 'upgradesUpdate',
      upgrades: { mini_cube_value: 1 },
    });
    expect(onlyType(peer, 'economyUpdate')).toEqual({
      type: 'economyUpdate',
      coins: 90,
      clicks: 0,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });

    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    expect(peer.messages().filter((message) => message.type === 'economyUpdate')).toHaveLength(1);
    expect(await repo.findByUserId('u1')).toEqual({
      coins: 90,
      clicks: 0,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('keeps the join idle credit as an immediate pre-welcome frame (AC-21)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 5 });
    await repo.touchLastSeen('u1', 0, null);
    const h = createAccountHarness(repo);
    h.setNow(120_000);

    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();

    expect(peer.messages().map((message) => message.type)).toEqual(['economyUpdate', 'welcome']);
    expect(onlyType(peer, 'economyUpdate')).toEqual({
      type: 'economyUpdate',
      coins: 6.2,
      clicks: 0,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('drops a late older purchase and keeps the newer multiplier for later credits (AC-29c)', async () => {
    const repo = new DeferredEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    const release = repo.holdNextPurchase();
    peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
    await drainMicrotasks();
    peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
    await drainMicrotasks();
    expect(onlyType(peer, 'upgradesUpdate')).toEqual({
      type: 'upgradesUpdate',
      upgrades: { mini_cube_value: 2 },
    });

    release();
    await drainMicrotasks();
    expect(peer.messages().filter((message) => message.type === 'upgradesUpdate')).toHaveLength(1);
    expect(onlyType(peer, 'upgradesUpdate')).toEqual({
      type: 'upgradesUpdate',
      upgrades: { mini_cube_value: 2 },
    });
    const stored = await repo.findByUserId('u1');
    expect(stored).toEqual({
      coins: 70,
      clicks: 0,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
    expect(onlyType(peer, 'economyUpdate')).toEqual({ type: 'economyUpdate', ...stored });

    peer.clear();
    explode(peer, 'front:0:0');
    await drainMicrotasks();
    expect(repo.creditDeltas.at(-1)).toEqual({
      coins: 0.12,
      clicks: 1,
      facesDestroyed: 0,
    });
  });

  it('applies a newest purchase upgrades after a newer credit without regressing economy (AC-29b)', async () => {
    const repo = new DeferredEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    const release = repo.holdNextPurchase();
    peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
    await drainMicrotasks();
    explode(peer, 'front:0:0');
    await drainMicrotasks();
    expect(peer.messages().filter((message) => message.type === 'economyUpdate')).toEqual([]);

    release();
    await drainMicrotasks();
    expect(onlyType(peer, 'upgradesUpdate')).toEqual({
      type: 'upgradesUpdate',
      upgrades: { mini_cube_value: 1 },
    });
    expect(peer.messages().filter((message) => message.type === 'economyUpdate')).toEqual([]);

    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    const stored = await repo.findByUserId('u1');
    expect(stored).toEqual({
      coins: 90.1,
      clicks: 1,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
    expect(onlyType(peer, 'economyUpdate')).toEqual({ type: 'economyUpdate', ...stored });
    expect(peer.messages().filter((message) => message.type === 'upgradesUpdate')).toHaveLength(1);
  });

  it('drops a credit that resolves after a newer purchase flush (AC-29 race)', async () => {
    const repo = new DeferredEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    const release = repo.holdNextCredit();
    explode(peer, 'front:0:0');
    await drainMicrotasks();
    peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
    await drainMicrotasks();

    const stored = await repo.findByUserId('u1');
    expect(stored).toEqual({
      coins: 90.1,
      clicks: 1,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
    expect(onlyType(peer, 'upgradesUpdate')).toEqual({
      type: 'upgradesUpdate',
      upgrades: { mini_cube_value: 1 },
    });
    expect(onlyType(peer, 'economyUpdate')).toEqual({ type: 'economyUpdate', ...stored });

    release();
    await drainMicrotasks();
    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
    expect(peer.messages().filter((message) => message.type === 'economyUpdate')).toHaveLength(1);
    expect(onlyType(peer, 'economyUpdate')).toEqual({ type: 'economyUpdate', ...stored });
  });

  it('returns before encoding when a coalesced flush has no joined connection (AC-22)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    explode(peer, 'front:0:0');
    await drainMicrotasks();
    const stringify = vi.spyOn(JSON, 'stringify');
    peer.drop();
    h.advance(ECONOMY_BROADCAST_INTERVAL_MS);

    expect(encodeCallsFor(stringify, 'economyUpdate')).toEqual([]);
    expect(peer.messages()).toEqual([]);
  });

  it('delivers the latest totals in a rejoin welcome during a pending window (AC-22)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    const token = welcomeOf(peer).token;
    peer.clear();

    explode(peer, 'front:0:0');
    await drainMicrotasks();
    peer.drop();
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));
    await drainMicrotasks();

    const welcome = welcomeOf(resumed);
    expect(welcome.economy).toEqual({
      coins: 0.1,
      clicks: 1,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('starts a joining tab from a newer applied revision than its own read (AC-22)', async () => {
    const repo = new DeferredJoinRepository();
    await repo.creditWithRevision('u1', { coins: 5 });
    const h = createAccountHarness(repo);
    const first = h.connect();
    h.join(first);
    await drainMicrotasks();
    first.clear();

    // The second tab's economy read is taken at revision 1, then held while a newer
    // revision 2 write happens on the first tab.
    const release = repo.holdEconomySnapshot();
    const second = h.connect();
    h.join(second);
    await drainMicrotasks();
    explode(first, 'front:0:0');
    await drainMicrotasks();

    release();
    await drainMicrotasks();

    const welcome = welcomeOf(second);
    expect(welcome.economy).toEqual({
      coins: 5.1,
      clicks: 1,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
    expect(second.messages().filter((message) => message.type === 'economyUpdate')).toEqual([]);
    expect(h.hub.revisionStateForTesting()).toEqual({
      economyRevisions: 1,
      upgradeRevisions: 1,
    });
  });
});

describe('shutdown guard (T3-B)', () => {
  it('discards pending removal/economy state and makes timers inert after close (AC-30)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    explode(peer, 'front:0:0');
    await drainMicrotasks();
    expect(h.hub.revisionStateForTesting()).toEqual({
      economyRevisions: 1,
      upgradeRevisions: 1,
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    h.hub.close();
    expect(h.hub.revisionStateForTesting()).toEqual({
      economyRevisions: 0,
      upgradeRevisions: 0,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(h.hub.connectionCount()).toBe(0);

    h.advance(1000);
    expect(peer.messages()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a deferred credit that resolves after close', async () => {
    const repo = new DeferredEconomyRepository();
    const h = createAccountHarness(repo);
    const peer = h.connect();
    h.join(peer);
    await drainMicrotasks();
    peer.clear();

    const release = repo.holdNextCredit();
    explode(peer, 'front:0:0');
    await drainMicrotasks();
    h.hub.close();
    release();
    await drainMicrotasks();
    h.advance(1000);

    // The DB write still happened once (one write per click); only the continuation is inert.
    expect(await repo.findByUserId('u1')).toEqual({
      coins: 0.1,
      clicks: 1,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
    expect(peer.messages()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.hub.revisionStateForTesting()).toEqual({
      economyRevisions: 0,
      upgradeRevisions: 0,
    });
  });

  it('leaves no member, token, connection, timer or send when a deferred join resolves after close (AC-30)', async () => {
    const repo = new DeferredJoinRepository();
    const config = loadGameConfig({});
    const registry = new CountingRegistry(createServerRegistry(config.maxUsersPerServer));
    const clock = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => () => 0,
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      economy: repo,
      registry,
    });
    const release = repo.holdEconomySnapshot();
    const peer = new FakePeer();
    hub.attach(peer, { userId: 'u1', username: 'alice', verified: true });
    peer.receive(JSON.stringify({ type: 'join' }));
    await drainMicrotasks();
    expect(registry.assignCalls).toBe(0);

    hub.close();
    release();
    await drainMicrotasks();

    expect(registry.assignCalls).toBe(0);
    expect(peer.messages()).toEqual([]);
    expect(hub.connectionCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(hub.revisionStateForTesting()).toEqual({
      economyRevisions: 0,
      upgradeRevisions: 0,
    });
  });

  it('drops late client frames and closes a late attach after close (AC-30)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    harness.hub.close();
    first.receive(JSON.stringify({ type: 'explode', id: 'front:0:0', level: 0 }));
    first.receive(JSON.stringify({ type: 'join' }));
    first.receive(JSON.stringify({ type: 'rotate', yawSteps: 1, pitchSteps: 0 }));
    harness.advance(1000);

    expect(first.messages()).toEqual([]);
    expect(second.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    const late = harness.connect();
    expect(late.closed).toBe(true);
    expect(harness.hub.connectionCount()).toBe(0);
  });
});

describe('registry index hot paths (T3-B)', () => {
  it('calls registry.servers() zero times across join/explode/completion/rotate/leave (AC-7)', () => {
    const config = loadGameConfig({ maxUsersPerServer: 12 });
    const registry = new CountingRegistry(createServerRegistry(config.maxUsersPerServer));
    let clock = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => () => 0,
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      registry,
    });
    const first = new FakePeer();
    hub.attach(first);
    first.receive(JSON.stringify({ type: 'join' }));
    const second = new FakePeer();
    hub.attach(second);
    second.receive(JSON.stringify({ type: 'join' }));
    expect(registry.assignCalls).toBe(2);

    const ids = allIds(3);
    // One accepted explode plus its 40 ms flush.
    explode(first, ids[0]!);
    vi.advanceTimersByTime(MINI_CUBE_BATCH_WINDOW_MS);
    // Age the click out of the trailing second, then remove the rest of the level (30/s).
    clock += 1000;
    vi.advanceTimersByTime(1000);
    for (let index = 1; index < ids.length; index += 1) {
      if ((index - 1) % 30 === 0) {
        clock += 1000;
        vi.advanceTimersByTime(1000);
      }
      explode(first, ids[index]!);
    }
    // Completion (boundary flush included), then a rotate and a grace-expiry removal.
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    first.receive(JSON.stringify({ type: 'rotate', yawSteps: 1, pitchSteps: 0 }));
    second.drop();
    clock += config.reconnectGraceMs;
    vi.advanceTimersByTime(config.reconnectGraceMs);

    expect(registry.snapshots).toBe(0);
    expect(registry.assignCalls).toBe(2);
    expect(hub.connectionCount()).toBe(1);
  });
});

describe('runtime observability (T2)', () => {
  /** One captured `LogSink` call: level, event name and structured fields. */
  interface RecordedLog {
    level: 'info' | 'warn' | 'error';
    event: string;
    fields: LogFields;
  }

  interface LogRecorder extends LogSink {
    readonly entries: RecordedLog[];
  }

  function createLogRecorder(): LogRecorder {
    const entries: RecordedLog[] = [];
    return {
      entries,
      info(event, fields) {
        entries.push({ level: 'info', event, fields });
      },
      warn(event, fields) {
        entries.push({ level: 'warn', event, fields });
      },
      error(event, fields) {
        entries.push({ level: 'error', event, fields });
      },
    };
  }

  /**
   * A hub with the T1 metrics registry and a captured log sink. Every connection gets an
   * explicit `connectionId` (default `req-<n>`) so lifecycle logs stay correlated.
   */
  function createObservabilityHarness(
    overrides: Partial<GameConfig> = {},
    options: { draw?: () => number; economy?: InMemoryEconomyRepository } = {},
  ) {
    const config: GameConfig = { ...loadGameConfig({}), ...overrides };
    const metrics = createMetrics();
    const log = createLogRecorder();
    let clock = 0;
    let counter = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => options.draw ?? (() => 0),
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      metrics,
      log,
      ...(options.economy === undefined ? {} : { economy: options.economy }),
    });
    return {
      config,
      hub,
      metrics,
      log,
      connect(connectionId?: string, session: AccountSession | null = null): FakePeer {
        counter += 1;
        const peer = new FakePeer();
        hub.attach(peer, session, connectionId ?? `req-${counter}`);
        return peer;
      },
      join(peer: FakePeer): void {
        peer.receive(JSON.stringify({ type: 'join' }));
      },
      advance(ms: number): void {
        clock += ms;
        vi.advanceTimersByTime(ms);
      },
      advanceTimersOnly(ms: number): void {
        vi.advanceTimersByTime(ms);
      },
      setNow(ms: number): void {
        clock = ms;
      },
    };
  }

  /** The numeric value of one exact rendered sample (`name` or `name{labels}`), or `null`. */
  function sampleValue(metrics: Metrics, sample: string): number | null {
    const line = metrics
      .render()
      .split('\n')
      .find((candidate) => candidate.startsWith(`${sample} `));
    if (line === undefined) {
      return null;
    }
    return Number(line.slice(sample.length + 1));
  }

  describe('connection lifecycle metrics and logs (AC-10, AC-3)', () => {
    it('counts attaches, capacity rejections, client closes and durations with exact samples', () => {
      const h = createObservabilityHarness({ maxConnections: 2 });
      const first = h.connect('req-1');
      const second = h.connect('req-2');

      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_total')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_capacity')).toBe(2);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="client"}'),
      ).toBeNull();

      const rejected = h.connect('req-3');
      expect(rejected.closed).toBe(true);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_connections_rejected_total{reason="capacity"}'),
      ).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(2);

      h.setNow(1500);
      first.drop();

      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(1);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="client"}'),
      ).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connection_duration_seconds_count')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connection_duration_seconds_sum')).toBe(1.5);
      expect(second.closed).toBe(false);

      expect(h.log.entries).toEqual([
        { level: 'info', event: 'ws_connection_opened', fields: { connectionId: 'req-1' } },
        { level: 'info', event: 'ws_connection_opened', fields: { connectionId: 'req-2' } },
        {
          level: 'warn',
          event: 'ws_connection_rejected',
          fields: { connectionId: 'req-3', reason: 'capacity' },
        },
        {
          level: 'info',
          event: 'ws_connection_closed',
          fields: { connectionId: 'req-1', reason: 'client', durationMs: 1500, wasJoined: false },
        },
      ]);
    });

    it('terminates on the second missed pong with timeout, heartbeat close and duration metrics', () => {
      const h = createObservabilityHarness();
      const peer = h.connect('req-hb');
      h.join(peer);

      h.advance(30_000);
      h.advance(30_000);
      h.advance(30_000);

      expect(peer.closed).toBe(true);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_heartbeat_timeouts_total')).toBe(1);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="heartbeat"}'),
      ).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connection_duration_seconds_count')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connection_duration_seconds_sum')).toBe(90);
      expect(h.log.entries).toEqual([
        { level: 'info', event: 'ws_connection_opened', fields: { connectionId: 'req-hb' } },
        {
          level: 'warn',
          event: 'ws_heartbeat_timeout',
          fields: { connectionId: 'req-hb', wasJoined: true },
        },
        {
          level: 'info',
          event: 'ws_connection_closed',
          fields: {
            connectionId: 'req-hb',
            reason: 'heartbeat',
            durationMs: 90_000,
            wasJoined: true,
          },
        },
      ]);
    });

    it('reports a send failure as an error close while the fan-out continues', () => {
      const h = createObservabilityHarness({ maxUsersPerServer: 2 });
      const thrower = new ThrowingPeer();
      h.hub.attach(thrower, null, 'req-1');
      h.join(thrower);
      const other = h.connect('req-2');
      h.join(other);
      thrower.clear();
      other.clear();
      thrower.failNextSend = true;

      explode(thrower, 'front:0:0');
      flushRemovals(h);

      expect(thrower.closed).toBe(true);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="error"}'),
      ).toBe(1);
      expect(other.messages()).toEqual([
        { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
      ]);
      expect(h.log.entries).toContainEqual({
        level: 'info',
        event: 'ws_connection_closed',
        fields: { connectionId: 'req-1', reason: 'error', durationMs: 0, wasJoined: true },
      });
    });

    it('logs hub_closed with pre-clear counts and counts server closes on shutdown', () => {
      const h = createObservabilityHarness({ maxUsersPerServer: 2 });
      const first = h.connect('req-1');
      h.join(first);
      const second = h.connect('req-2');
      h.join(second);

      h.hub.close();

      expect(h.log.entries.at(-1)).toEqual({
        level: 'info',
        event: 'hub_closed',
        fields: { connections: 2, members: 2, servers: 1 },
      });
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="server"}'),
      ).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(0);
    });

    it('uses the unknown placeholder when a direct attach has no request id', () => {
      const h = createObservabilityHarness();
      const peer = new FakePeer();

      h.hub.attach(peer);
      peer.drop();

      expect(h.log.entries).toEqual([
        { level: 'info', event: 'ws_connection_opened', fields: { connectionId: 'unknown' } },
        {
          level: 'info',
          event: 'ws_connection_closed',
          fields: { connectionId: 'unknown', reason: 'client', durationMs: 0, wasJoined: false },
        },
      ]);
    });
  });

  describe('messages, encode-once and fan-out (AC-11)', () => {
    it('records types, one removal encode, per-recipient frames and fan-out after the join baseline', () => {
      const h = createObservabilityHarness({ maxUsersPerServer: 2 });
      const first = h.connect('req-1');
      h.join(first);
      const second = h.connect('req-2');
      h.join(second);

      // Baseline after the second join's `memberJoined` broadcast settled: the first join
      // broadcast had no recipients, the second had one; the first join's accepted activity
      // candidate is one more server broadcast with no recipients (the joiner is excepted).
      expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcasts_total')).toBe(3);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_count')).toBe(3);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_sum')).toBe(1);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="join"}'),
      ).toBe(2);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="memberJoined"}'),
      ).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="memberJoined"}')).toBe(
        1,
      );
      expect(sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="welcome"}')).toBe(
        2,
      );
      expect(sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="welcome"}')).toBe(2);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="activityEvent"}'),
      ).toBe(1);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="activityEvent"}'),
      ).toBeNull();

      explode(first, 'front:0:0');
      flushRemovals(h);

      expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcasts_total')).toBe(4);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_count')).toBe(4);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_sum')).toBe(3);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="miniCubeRemoved"}'),
      ).toBe(1);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="miniCubeRemoved"}'),
      ).toBe(2);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="explode"}'),
      ).toBe(1);
      const removal = { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' };
      expect(first.messages().at(-1)).toEqual(removal);
      expect(second.messages().at(-1)).toEqual(removal);

      first.receive('{');
      first.receive('x'.repeat(1025));
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="invalid"}'),
      ).toBe(1);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="oversized"}'),
      ).toBe(1);
    });
  });

  describe('room, member and capacity gauges (AC-12)', () => {
    it('tracks joins, a move/server destroy and the final leave', () => {
      // The third join draws 0.5 for its next cube after completion (the pinned merge flow).
      const draws = [0, 0, 0, 0.5];
      let drawIndex = 0;
      const h = createObservabilityHarness(
        { maxUsersPerServer: 2 },
        { draw: () => draws[drawIndex++] ?? 0 },
      );
      const first = h.connect('req-1');
      h.join(first);
      const second = h.connect('req-2');
      h.join(second);
      const third = h.connect('req-3');
      h.join(third);

      expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(3);
      expect(sampleValue(h.metrics, 'cubeclicker_server_capacity')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_capacity')).toBe(200);

      // Grace expiry removes p1: two live servers and two roster members.
      first.drop();
      h.advance(h.config.reconnectGraceMs);
      expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(2);

      // The lone server-2 member completes and moves into server 1; server 2 is destroyed.
      removeLevel(h, third, allIds(3));
      third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
      expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(2);

      // The last two members leave; the final server is destroyed.
      second.drop();
      third.drop();
      h.advance(h.config.reconnectGraceMs);
      expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(0);
    });
  });

  describe('removal and economy flush depths and cadence (AC-13)', () => {
    it('tracks removal pending groups, flush count, id total and batch size', () => {
      const h = createObservabilityHarness();
      const peer = h.connect('req-1');
      h.join(peer);
      const ids = allIds(3);

      explode(peer, ids[0]!);
      explode(peer, ids[1]!);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_batch_pending_groups')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_flushes_total')).toBe(0);

      h.advanceTimersOnly(MINI_CUBE_BATCH_WINDOW_MS);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_batch_pending_groups')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_flushes_total')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_ids_total')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_batch_size_count')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_removal_batch_size_sum')).toBe(2);
    });

    it('tracks economy pending accounts and cadence, then resets the gauges on close', async () => {
      const repo = new InMemoryEconomyRepository();
      const h = createObservabilityHarness({}, { economy: repo });
      const peer = h.connect('req-a', { userId: 'u1', username: 'alice', verified: true });
      h.join(peer);
      await drainMicrotasks();

      explode(peer, 'front:0:0');
      await drainMicrotasks();
      expect(sampleValue(h.metrics, 'cubeclicker_economy_pending_accounts')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_flushes_total')).toBe(0);

      h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_pending_accounts')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_flushes_total')).toBe(1);

      // Leave one removal group and one economy snapshot pending, then shut down.
      explode(peer, 'front:0:1');
      await drainMicrotasks();
      expect(sampleValue(h.metrics, 'cubeclicker_removal_batch_pending_groups')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_pending_accounts')).toBe(1);

      h.hub.close();
      expect(sampleValue(h.metrics, 'cubeclicker_removal_batch_pending_groups')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_pending_accounts')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(0);
    });
  });

  describe('rate-limit drops (AC-14)', () => {
    it('counts every dropped explode and rotate while received totals keep the parsed types', () => {
      const h = createObservabilityHarness({ clickRateLimitPerSecond: 2 });
      const peer = h.connect('req-1');
      h.join(peer);
      const ids = allIds(3);

      explode(peer, ids[0]!);
      explode(peer, ids[1]!);
      explode(peer, ids[2]!);
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="explode"}'),
      ).toBe(3);
      expect(sampleValue(h.metrics, 'cubeclicker_rate_limit_drops_total{scope="explode"}')).toBe(1);

      for (let index = 0; index < 21; index += 1) {
        peer.receive(JSON.stringify({ type: 'rotate', yawSteps: index, pitchSteps: 0 }));
      }
      expect(sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="rotate"}')).toBe(
        21,
      );
      expect(sampleValue(h.metrics, 'cubeclicker_rate_limit_drops_total{scope="rotate"}')).toBe(1);
      // The admitted 20 rotated; the 21st was dropped before any encode/broadcast.
      expect(
        sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="cubeRotated"}'),
      ).toBe(20);
    });

    it('answers a pre-join ping exactly once per second and counts the dropped ping', () => {
      const h = createObservabilityHarness();
      const peer = h.connect('req-ping');

      peer.receive('{"type":"ping","t":123}');
      expect(peer.sent).toEqual(['{"type":"pong","t":123}']);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="ping"}')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="pong"}')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="pong"}')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_rate_limit_drops_total{scope="ping"}')).toBeNull();

      peer.receive('{"type":"ping","t":456}');
      expect(peer.sent).toEqual(['{"type":"pong","t":123}']);
      expect(sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="ping"}')).toBe(2);
      expect(sampleValue(h.metrics, 'cubeclicker_rate_limit_drops_total{scope="ping"}')).toBe(1);

      h.advance(PING_RATE_LIMIT_MS);
      peer.receive('{"type":"ping","t":789}');
      expect(peer.sent).toEqual(['{"type":"pong","t":123}', '{"type":"pong","t":789}']);
      expect(sampleValue(h.metrics, 'cubeclicker_rate_limit_drops_total{scope="ping"}')).toBe(1);
    });
  });

  describe('stale revision rejections (AC-15)', () => {
    it('counts a stale economy snapshot but not a result rejected by the closed hub', async () => {
      const repo = new DeferredEconomyRepository();
      const h = createObservabilityHarness({}, { economy: repo });
      const peer = h.connect('req-a', { userId: 'u1', username: 'alice', verified: true });
      h.join(peer);
      await drainMicrotasks();
      peer.clear();

      const release = repo.holdNextCredit();
      explode(peer, 'front:0:0');
      explode(peer, 'front:0:1');
      await drainMicrotasks();
      h.advance(ECONOMY_BROADCAST_INTERVAL_MS);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_revision_rejections_total')).toBe(0);

      release();
      await drainMicrotasks();
      expect(sampleValue(h.metrics, 'cubeclicker_economy_revision_rejections_total')).toBe(1);

      // A deferred result rejected only because the hub is closed is not a stale rejection.
      const releaseAfterClose = repo.holdNextCredit();
      explode(peer, 'front:0:2');
      await drainMicrotasks();
      h.hub.close();
      releaseAfterClose();
      await drainMicrotasks();
      expect(sampleValue(h.metrics, 'cubeclicker_economy_revision_rejections_total')).toBe(1);
    });

    it('counts a late older purchase on both revision guards (AC-15)', async () => {
      const repo = new DeferredEconomyRepository();
      await repo.creditWithRevision('u1', { coins: 100 });
      const h = createObservabilityHarness({}, { economy: repo });
      const peer = h.connect('req-a', { userId: 'u1', username: 'alice', verified: true });
      h.join(peer);
      await drainMicrotasks();
      peer.clear();

      const release = repo.holdNextPurchase();
      peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
      await drainMicrotasks();
      peer.receive('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}');
      await drainMicrotasks();
      expect(sampleValue(h.metrics, 'cubeclicker_upgrade_revision_rejections_total')).toBe(0);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_revision_rejections_total')).toBe(0);

      release();
      await drainMicrotasks();

      expect(sampleValue(h.metrics, 'cubeclicker_upgrade_revision_rejections_total')).toBe(1);
      expect(sampleValue(h.metrics, 'cubeclicker_economy_revision_rejections_total')).toBe(1);
    });
  });

  describe('log privacy (AC-3)', () => {
    it('logs only connection lifecycle fields, never player/account/username or payload values', async () => {
      const repo = new InMemoryEconomyRepository();
      const h = createObservabilityHarness({}, { economy: repo });
      const peer = h.connect('req-pii', {
        userId: 'account-9',
        username: 'alice@example.test',
        verified: true,
      });
      h.join(peer);
      await drainMicrotasks();
      peer.receive('{"type":"explode","id":"front:0:0","level":0}');
      peer.drop();
      h.hub.close();

      expect(h.log.entries.map((entry) => entry.event)).toEqual([
        'ws_connection_opened',
        'ws_connection_closed',
        'hub_closed',
      ]);
      expect(h.log.entries[0]).toEqual({
        level: 'info',
        event: 'ws_connection_opened',
        fields: { connectionId: 'req-pii' },
      });
      const serialized = JSON.stringify(h.log.entries);
      expect(serialized).not.toContain('account-9');
      expect(serialized).not.toContain('alice@example.test');
      expect(serialized).not.toContain('p1');
      expect(serialized).not.toContain('front:0:0');
      expect(serialized).not.toContain('u1');
    });
  });
});

describe('server activity feed (live-activity-feed)', () => {
  interface FeedHarnessOptions {
    overrides?: Partial<GameConfig>;
    /** The inner RNG draw (defaults to 0 → every cube is 3×3). */
    draw?: () => number;
    economy?: InMemoryEconomyRepository;
    wrapRegistry?: (inner: ServerRegistry) => ServerRegistry;
  }

  /** A hub with a manual clock, a metrics registry and an optional economy repository. */
  function createFeedHarness(options: FeedHarnessOptions = {}) {
    const config: GameConfig = { ...loadGameConfig({}), ...options.overrides };
    const metrics = createMetrics();
    let clock = 0;
    const innerRegistry = createServerRegistry(config.maxUsersPerServer);
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => options.draw ?? (() => 0),
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      metrics,
      ...(options.economy === undefined ? {} : { economy: options.economy }),
      ...(options.wrapRegistry === undefined
        ? {}
        : { registry: options.wrapRegistry(innerRegistry) }),
    });
    return {
      config,
      hub,
      metrics,
      setNow: (ms: number) => {
        clock = ms;
      },
      advanceTimersOnly: (ms: number) => {
        vi.advanceTimersByTime(ms);
      },
      connect: (session: AccountSession | null = null) => {
        const peer = new FakePeer();
        hub.attach(peer, session);
        return peer;
      },
      join: (peer: FakePeer) => {
        peer.receive(JSON.stringify({ type: 'join' }));
      },
      flush: async () => {
        for (let i = 0; i < 50; i += 1) {
          await Promise.resolve();
        }
      },
    };
  }

  /** The numeric value of one exact rendered sample (`name` or `name{labels}`), or `null`. */
  function sampleValue(metrics: Metrics, sample: string): number | null {
    const line = metrics
      .render()
      .split('\n')
      .find((candidate) => candidate.startsWith(`${sample} `));
    if (line === undefined) {
      return null;
    }
    return Number(line.slice(sample.length + 1));
  }

  /** Every `activityEvent` frame on `peer`, in arrival order. */
  function activityFrames(peer: FakePeer): ActivityEventFrame[] {
    return peer
      .messages()
      .filter((message): message is ActivityEventFrame => message.type === 'activityEvent');
  }

  /** Removes one whole level without moving the hub clock (the pinned click limit is raised). */
  function clearLevel(peer: FakePeer, level: number): void {
    for (const id of allIds(3)) {
      explode(peer, id, level);
    }
  }

  /** A registry that reports a no-op removal for one player while still removing them. */
  class NoOpReportingRegistry implements ServerRegistry {
    constructor(
      private readonly inner: ServerRegistry,
      private readonly playerId: string,
    ) {}

    serverCount(): number {
      return this.inner.serverCount();
    }

    servers() {
      return this.inner.servers();
    }

    locationOf(playerId: string) {
      return this.inner.locationOf(playerId);
    }

    forEachMember(serverId: number, visit: (playerId: string, slot: number) => void): void {
      this.inner.forEachMember(serverId, visit);
    }

    assign(joining: string) {
      return this.inner.assign(joining);
    }

    removeMember(playerId: string) {
      const removal = this.inner.removeMember(playerId);
      if (playerId === this.playerId && removal.left) {
        return { left: false, serverDestroyed: false };
      }
      return removal;
    }

    moveMember(playerId: string, targetServerId: number) {
      return this.inner.moveMember(playerId, targetServerId);
    }

    plan() {
      return this.inner.plan();
    }
  }

  /** A repository that can hold the next loot open after the draw, before the write. */
  class HoldingLootRepository extends InMemoryEconomyRepository {
    private gate: Promise<void> | null = null;
    private release: (() => void) | null = null;
    openCalls = 0;

    holdNextOpen(): void {
      this.gate = new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }

    releaseOpen(): void {
      this.release?.();
      this.release = null;
      this.gate = null;
    }

    override async applyLootboxOpenV2(
      userId: string,
      partId: PartIdV2,
    ): Promise<
      | { state: CustomizationState; duplicate: boolean }
      | { reason: 'no_lootbox' }
      | { reason: 'no_key' }
    > {
      this.openCalls += 1;
      const gate = this.gate;
      if (gate !== null) {
        await gate;
      }
      return super.applyLootboxOpenV2(userId, partId);
    }
  }

  it('records a fresh join once and excludes the joiner from its own live frame (AC-5)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.setNow(1000);
    h.join(second);

    // The joiner's own welcome carries the pre-join ring and no live frame.
    expect(welcomeOf(second).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
    expect(activityFrames(second)).toEqual([]);
    // The existing member hears the protocol broadcast and the accepted activity frame.
    expect(first.messages().slice(1)).toEqual([
      { type: 'memberJoined', member: memberOf('p2', 'Player 2', X3_SLOT_2) },
      transitionActivity(2, 1000, 1, 'memberJoined', 'p2', 'Player 2'),
    ]);
  });

  it('records a fastClear with the hub-measured completion time (AC-2)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);

    clearLevel(first, 0);
    flushRemovals(h);
    first.clear();
    second.clear();
    h.setNow(1000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const expected = [
      {
        type: 'levelAdvanced',
        playerId: 'p1',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'crimson-alloy',
        position: X3_SLOT_1,
        removedIds: [],
      },
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ];
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);
  });

  it('records a cubeCleared for a slow completion (AC-1)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);

    clearLevel(first, 0);
    flushRemovals(h);
    first.clear();
    second.clear();
    // 20 s > thresholdSeconds(3) = 15 s: no speed bonus.
    h.setNow(20_000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const expected = [
      {
        type: 'levelAdvanced',
        playerId: 'p1',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'crimson-alloy',
        position: X3_SLOT_1,
        removedIds: [],
      },
      clearedActivity(2, 20_000, 1, 'p1', 'Player 1', 1),
    ];
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);
  });

  it('prefers levelMilestone over a fast 5th completion and never emits two events (AC-3)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const peer = h.connect();
    h.join(peer);
    peer.clear();

    for (let level = 0; level < 4; level += 1) {
      clearLevel(peer, level);
      h.setNow((level + 1) * 1000);
      peer.receive(JSON.stringify({ type: 'cubeCompleted', level }));
    }
    // The 5th completion is fast (elapsed 1 s) yet must be a milestone, not a fastClear.
    clearLevel(peer, 4);
    h.setNow(5000);
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 4 }));

    expect(activityFrames(peer)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
      fastActivity(3, 2000, 1, 'p1', 'Player 1', 2, 1000),
      fastActivity(4, 3000, 1, 'p1', 'Player 1', 3, 1000),
      fastActivity(5, 4000, 1, 'p1', 'Player 1', 4, 1000),
      milestoneActivity(6, 5000, 1, 'p1', 'Player 1', 5),
    ]);
  });

  it('records an epicLoot for new and duplicate epics (AC-4)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    const draws = [0, 0.999999, 0.999999];
    let drawIndex = 0;
    const h = createFeedHarness({
      economy: repo,
      draw: () => draws[drawIndex++] ?? 0,
    });
    const peer = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(peer);
    await h.flush();
    peer.clear();

    h.setNow(1000);
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    h.setNow(2000);
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    const reveals = peer
      .messages()
      .filter((message): message is Extract<ServerMessage, { type: 'lootboxOpened' }> => {
        return message.type === 'lootboxOpened';
      });
    expect(reveals.map((reveal) => [reveal.partId, reveal.rarity, reveal.duplicate])).toEqual([
      ['shot-kite-solar', 'epic', false],
      ['shot-kite-solar', 'epic', true],
    ]);
    expect(activityFrames(peer)).toEqual([
      epicActivity(2, 1000, 1, 'p1', 'alice', 'shot-kite-solar'),
      epicActivity(3, 2000, 1, 'p1', 'alice', 'shot-kite-solar'),
    ]);
  });

  it('records a final grace-expiry leave after the protocol broadcast (AC-6)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    second.drop();
    h.setNow(30_000);
    h.advanceTimersOnly(30_000);

    expect(messagesWithoutLeaderboard(first)).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p2', 'Player 2'),
    ]);
    expect(messagesWithoutLeaderboard(second)).toEqual([]);
  });

  it('drops a 999 ms memberJoined candidate without consuming an id (AC-9)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 4 } });
    const first = h.connect();
    h.join(first);
    first.clear();
    const second = h.connect();
    h.setNow(999);
    h.join(second);

    expect(activityFrames(second)).toEqual([]);
    expect(welcomeOf(second).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
    // A third join at the same instant is dropped too; its welcome shows the same ring/id.
    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
    expect(activityFrames(first)).toEqual([]);
  });

  it('drops a 999 ms cubeCleared candidate without consuming an id (AC-9)', () => {
    const h = createFeedHarness({
      overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    clearLevel(first, 0);
    flushRemovals(h);
    h.setNow(16_000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    first.clear();
    second.clear();

    clearLevel(second, 0);
    flushRemovals(h);
    first.clear();
    second.clear();
    h.setNow(16_999);
    second.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(first.messages()).toEqual([
      {
        type: 'levelAdvanced',
        playerId: 'p2',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'crimson-alloy',
        position: X3_SLOT_2,
        removedIds: [],
      },
    ]);
    const verifier = h.connect();
    h.join(verifier);
    // The 16 000 event is 999 ms old at 16 999; the `at: 0` join is TTL-expired.
    expect(welcomeOf(verifier).activity).toEqual([
      clearedActivity(2, 16_000, 1, 'p1', 'Player 1', 1).event,
    ]);
  });

  it('drops a 999 ms fastClear candidate without consuming an id (AC-9)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    clearLevel(first, 0);
    flushRemovals(h);
    h.setNow(1000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    first.clear();
    second.clear();

    clearLevel(second, 0);
    flushRemovals(h);
    first.clear();
    second.clear();
    h.setNow(1999);
    second.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(first.messages()).toEqual([
      {
        type: 'levelAdvanced',
        playerId: 'p2',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'crimson-alloy',
        position: X3_SLOT_2,
        removedIds: [],
      },
    ]);
    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000).event,
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
  });

  it('drops a 999 ms levelMilestone candidate without consuming an id (AC-9)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const peer = h.connect();
    h.join(peer);
    for (let level = 0; level < 4; level += 1) {
      clearLevel(peer, level);
      h.setNow((level + 1) * 1000);
      peer.receive(JSON.stringify({ type: 'cubeCompleted', level }));
    }
    peer.clear();

    // The 5th completion lands 999 ms after the 4th acceptance: the milestone is dropped.
    clearLevel(peer, 4);
    h.setNow(4999);
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 4 }));
    expect(activityFrames(peer)).toEqual([]);

    // The next accepted completion takes id 6, proving the dropped candidate consumed none.
    clearLevel(peer, 5);
    h.setNow(5000);
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 5 }));
    expect(activityFrames(peer)).toEqual([
      fastActivity(6, 5000, 1, 'p1', 'Player 1', 6, 1),
    ]);
  });

  it('drops a 999 ms epicLoot candidate without consuming an id (AC-9)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    const draws = [0, 0.999999, 0.999999];
    let drawIndex = 0;
    const h = createFeedHarness({ economy: repo, draw: () => draws[drawIndex++] ?? 0 });
    const peer = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(peer);
    await h.flush();

    h.setNow(1000);
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    peer.clear();
    h.setNow(1999);
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    expect(peer.messages().filter((message) => message.type === 'lootboxOpened')).toHaveLength(1);
    expect(activityFrames(peer)).toEqual([]);

    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      epicActivity(2, 1000, 1, 'p1', 'alice', 'shot-kite-solar').event,
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'alice').event,
    ]);
  });

  it('drops a 999 ms memberLeft candidate without consuming an id (AC-9)', () => {
    const h = createFeedHarness({
      overrides: { maxUsersPerServer: 3, reconnectGraceMs: 1000, clickRateLimitPerSecond: 1000 },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const secondToken = welcomeOf(second).token;

    clearLevel(first, 0);
    h.setNow(1000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    // The leave's deadline is 2000; a fresh join at the same instant is an accepted event, so
    // the leave candidate at 2000 is 0 ms after the acceptance and must be dropped.
    second.drop();
    const third = h.connect();
    h.setNow(2000);
    h.join(third);
    expect(activityFrames(first)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
      transitionActivity(3, 2000, 1, 'memberJoined', 'p3', 'Player 3'),
    ]);
    first.clear();

    const late = h.connect();
    late.receive(JSON.stringify({ type: 'rejoin', token: secondToken }));
    expect(late.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);
    expect(first.messages()).toEqual([{ type: 'memberLeft', playerId: 'p2', reason: 'left' }]);

    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      transitionActivity(3, 2000, 1, 'memberJoined', 'p3', 'Player 3').event,
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000).event,
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
  });

  it('accepts exactly at the inclusive 1000 ms boundary across event types (AC-9)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 4, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    clearLevel(first, 0);
    flushRemovals(h);
    first.clear();

    // 999 ms after the join is dropped.
    const second = h.connect();
    h.setNow(999);
    h.join(second);

    // Exactly 1000 ms after the join is accepted.
    h.setNow(1000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(activityFrames(first)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ]);

    // 999 ms after the completion is dropped; exactly 1000 ms is accepted.
    const third = h.connect();
    h.setNow(1999);
    h.join(third);
    expect(activityFrames(first)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ]);
    const fourth = h.connect();
    h.setNow(2000);
    h.join(fourth);
    expect(activityFrames(first)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
      transitionActivity(3, 2000, 1, 'memberJoined', 'p4', 'Player 4'),
    ]);
    // The dropped 999 ms join stayed out of the ring.
    expect(welcomeOf(second).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
    expect(welcomeOf(third).activity).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000).event,
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
  });

  it('creates no candidate for an invalid completion (AC-1)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    first.clear();
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
    expect(second.messages()).toEqual([]);
    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
  });

  it('creates no epicLoot for rare, failed or guest opens (AC-4)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 1, keys: 1 });
    // Both joins draw 0 for their cubes; the open draws 0 → rare hull-obsidian.
    const draws = [0, 0, 0];
    let drawIndex = 0;
    const h = createFeedHarness({ economy: repo, draw: () => draws[drawIndex++] ?? 0 });
    const account = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(account);
    await h.flush();
    const guest = h.connect();
    h.join(guest);
    await h.flush();
    account.clear();
    guest.clear();

    h.setNow(1000);
    account.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    expect(onlyType(account, 'lootboxOpened').rarity).toBe('rare');

    // Guest local opens are not server events.
    guest.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    // Both failed opens (no_lootbox then no_key) create no candidate.
    account.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    account.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    expect(activityFrames(account)).toEqual([]);
    expect(activityFrames(guest)).toEqual([]);

    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'alice').event,
    ]);
  });

  it('drops an in-flight duplicate open before any draw or candidate (AC-4)', async () => {
    const repo = new HoldingLootRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });
    // One epic draw is consumed; a second (unguarded) draw would return 0.5 → hull-gold.
    const draws = [0, 0.999999, 0.5];
    let drawIndex = 0;
    const h = createFeedHarness({ economy: repo, draw: () => draws[drawIndex++] ?? 0 });
    const peer = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(peer);
    await h.flush();
    peer.clear();

    repo.holdNextOpen();
    h.setNow(1000);
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    repo.releaseOpen();
    await h.flush();

    expect(repo.openCalls).toBe(1);
    expect(peer.messages().filter((message) => message.type === 'lootboxOpened')).toHaveLength(1);
    expect(activityFrames(peer)).toEqual([
      epicActivity(2, 1000, 1, 'p1', 'alice', 'shot-kite-solar'),
    ]);
  });

  it('records no event on rejoin and carries the current ring (AC-5/AC-13)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3 } });
    const first = h.connect();
    h.join(first);
    const token = welcomeOf(first).token;
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    first.drop();
    h.setNow(500);
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(welcomeOf(resumed).activity).toEqual([
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);
    expect(activityFrames(resumed)).toEqual([]);
    expect(activityFrames(second)).toEqual([]);
  });

  it('drops the buffer when the leave destroys the server (AC-6/AC-11)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connect();
    h.join(first);
    expect(welcomeOf(first).serverId).toBe(1);

    first.drop();
    h.setNow(30_000);
    h.advanceTimersOnly(30_000);

    // No leave frame at all (the server is gone) and the next server starts empty.
    const second = h.connect();
    h.join(second);
    const welcome = welcomeOf(second);
    expect(welcome.serverId).toBe(2);
    expect(welcome.activity).toEqual([]);
  });

  it('records nothing for a reported no-op removal (AC-6)', () => {
    const h = createFeedHarness({
      overrides: { maxUsersPerServer: 2, reconnectGraceMs: 1000 },
      wrapRegistry: (inner) => new NoOpReportingRegistry(inner, 'p2'),
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    second.drop();
    h.setNow(1000);
    h.advanceTimersOnly(1000);

    expect(messagesWithoutLeaderboard(first)).toEqual([]);
    expect(activityFrames(first)).toEqual([]);
  });

  it('move: the accepted completion is the sole new-server event and the leave follows the protocol frame (AC-7/AC-14)', () => {
    const h = createFeedHarness({
      overrides: { maxUsersPerServer: 2, reconnectGraceMs: 1000, clickRateLimitPerSecond: 1000 },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const third = h.connect();
    h.join(third);
    expect(welcomeOf(third).serverId).toBe(2);
    const thirdToken = welcomeOf(third).token;

    // p1's grace expires exactly at 1000 ms; the leave is accepted on server 1.
    first.drop();
    second.clear();
    third.clear();
    h.setNow(1000);
    h.advanceTimersOnly(1000);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 1000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);
    second.clear();

    // p3 completes at 2000 ms: the move destroys server 2 (no old-server leave) and the
    // completion is the sole new-server candidate (the move-in join is suppressed).
    clearLevel(third, 0);
    flushRemovals(h);
    third.clear();
    second.clear();
    h.setNow(2000);
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(third.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p3',
        name: 'Player 3',
        token: thirdToken,
        serverId: 1,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        roster: [
          memberOf('p3', 'Player 3', X2_SLOT_1, {
            levelIndex: 1,
            gridSize: 3,
            styleId: 'crimson-alloy',
            removedIds: [],
            yawSteps: 0,
            pitchSteps: 0,
          }),
          memberOf('p2', 'Player 2', X2_SLOT_2),
        ],
        activity: [
          transitionActivity(2, 1000, 1, 'memberLeft', 'p1', 'Player 1').event,
          transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
        ],
        leaderboard: {
          serverId: 1,
          at: 2000,
          entries: [
            { playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
        identity: { kind: 'guest', playerId: 'p3' },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      fastActivity(3, 2000, 1, 'p3', 'Player 3', 1, 2000),
    ]);
    expect(second.messages()).toEqual([
      {
        type: 'memberJoined',
        member: memberOf('p3', 'Player 3', X2_SLOT_1, {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
        }),
      },
      fastActivity(3, 2000, 1, 'p3', 'Player 3', 1, 2000),
    ]);
  });

  it('move: a dropped completion adds no new-server event and suppresses the move-in join (AC-7/AC-25)', () => {
    const h = createFeedHarness({
      overrides: { maxUsersPerServer: 2, reconnectGraceMs: 1000, clickRateLimitPerSecond: 1000 },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const third = h.connect();
    h.join(third);
    first.clear();
    second.clear();
    third.clear();

    // p1's close starts the 1000 ms grace before p4 joins (server 1 is still full).
    first.drop();
    const fourth = h.connect();
    h.setNow(500);
    h.join(fourth);
    expect(welcomeOf(fourth).serverId).toBe(2);
    third.clear();
    fourth.clear();

    // p1's leave is accepted on server 1 at 1000 ms.
    h.setNow(1000);
    h.advanceTimersOnly(1000);
    second.clear();

    // p4's fast completion is accepted on server 2 at 1000 ms.
    clearLevel(fourth, 0);
    flushRemovals(h);
    fourth.clear();
    third.clear();
    fourth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(activityFrames(third)).toEqual([
      fastActivity(2, 1000, 2, 'p4', 'Player 4', 1, 500),
    ]);
    third.clear();
    fourth.clear();

    // p3 completes at 1999 ms: both the old-server leave and the new-server completion are
    // 999 ms after an acceptance on their server, so neither is emitted and the move adds no
    // new-server activity at all.
    clearLevel(third, 0);
    flushRemovals(h);
    third.clear();
    fourth.clear();
    h.setNow(1999);
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(fourth.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p3', reason: 'moved' },
    ]);
    expect(second.messages()).toEqual([
      {
        type: 'memberJoined',
        member: memberOf('p3', 'Player 3', X2_SLOT_1, {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
        }),
      },
    ]);
    expect(activityFrames(second)).toEqual([]);

    // The old server's ring still has exactly p3's join and p4's completion (no leave id).
    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity).toEqual([
      fastActivity(2, 1000, 2, 'p4', 'Player 4', 1, 500).event,
      transitionActivity(1, 0, 2, 'memberJoined', 'p3', 'Player 3').event,
    ]);
  });

  it('serves only the five fresh events from the ring on reconnect (AC-13)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 10, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const token = welcomeOf(first).token;
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    // p1 is away while p2 accepts 25 completions, one per second.
    first.drop();
    for (let level = 0; level < 25; level += 1) {
      clearLevel(second, level);
      h.setNow((level + 1) * 1000);
      second.receive(JSON.stringify({ type: 'cubeCompleted', level }));
    }

    h.setNow(25_000);
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));
    const welcome = welcomeOf(resumed);
    // The ring still holds 20 events, but only events younger than 5000 ms travel: the
    // events at 25 000..21 000 are fresh; ids <= 21 (at <= 20 000) are TTL-expired.
    expect(welcome.activity.map((event) => event.id)).toEqual([
      26, 25, 24, 23, 22,
    ]);
    expect(welcome.activity[0]).toEqual(
      milestoneActivity(26, 25_000, 1, 'p2', 'Player 2', 25).event,
    );
    expect(welcome.activity[4]).toEqual(
      fastActivity(22, 21_000, 1, 'p2', 'Player 2', 21, 1000).event,
    );

    // The rejoin itself records nothing: a fresh join at the same instant sees the same ring.
    const verifier = h.connect();
    h.join(verifier);
    expect(welcomeOf(verifier).activity.map((event) => event.id)).toEqual([
      26, 25, 24, 23, 22,
    ]);
  });

  it('isolates two servers: buffers, ids and fan-out (AC-23)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 1, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    expect(welcomeOf(first).serverId).toBe(1);
    expect(welcomeOf(second).serverId).toBe(2);
    expect(welcomeOf(first).activity).toEqual([]);
    expect(welcomeOf(second).activity).toEqual([]);
    first.clear();
    second.clear();

    clearLevel(first, 0);
    clearLevel(second, 0);
    flushRemovals(h);
    first.clear();
    second.clear();
    h.setNow(1000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    second.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(activityFrames(first)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'Player 1', 1, 1000),
    ]);
    expect(activityFrames(second)).toEqual([
      fastActivity(2, 1000, 2, 'p2', 'Player 2', 1, 1000),
    ]);
    expect(first.messages().map((message) => message.type)).toEqual([
      'levelAdvanced',
      'activityEvent',
    ]);
    expect(second.messages().map((message) => message.type)).toEqual([
      'levelAdvanced',
      'activityEvent',
    ]);
  });

  it('encodes an accepted event once and fans the identical text to every member (AC-14)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    clearLevel(first, 0);
    flushRemovals(h);
    first.clear();
    second.clear();
    const stringify = vi.spyOn(JSON, 'stringify');
    h.setNow(1000);
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(encodeCallsFor(stringify, 'activityEvent')).toHaveLength(1);
    const expected =
      '{"type":"activityEvent","event":{"id":2,"at":1000,"serverId":1,"type":"fastClear","playerId":"p1","name":"Player 1","level":1,"elapsedMs":1000}}';
    expect(sentTextsOfType(first, 'activityEvent')).toEqual([expected]);
    expect(sentTextsOfType(second, 'activityEvent')).toEqual([expected]);
  });

  it('increments both metrics with the activityEvent type only (AC-12)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);

    // p1's join: the protocol broadcast (0 recipients) plus its accepted activity broadcast
    // (also 0, the joiner is excepted).
    expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcasts_total')).toBe(2);
    expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_count')).toBe(2);
    expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_sum')).toBe(0);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="activityEvent"}'),
    ).toBe(1);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="activityEvent"}'),
    ).toBeNull();

    // A join at exactly +1000 ms is accepted: protocol + activity, one recipient each.
    const second = h.connect();
    h.setNow(1000);
    h.join(second);

    expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcasts_total')).toBe(4);
    expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_count')).toBe(4);
    expect(sampleValue(h.metrics, 'cubeclicker_ws_broadcast_fanout_sum')).toBe(2);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="activityEvent"}'),
    ).toBe(2);
    expect(sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="activityEvent"}')).toBe(
      1,
    );
  });

  it('keeps the activity frame and welcome snapshot privacy-clean (AC-24)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 1, keys: 1 });
    const draws = [0, 0, 0.999999];
    let drawIndex = 0;
    const h = createFeedHarness({ economy: repo, draw: () => draws[drawIndex++] ?? 0 });
    const account = h.connect({ userId: 'account-9', username: 'alice', verified: true });
    h.join(account);
    await h.flush();
    const guest = h.connect();
    h.setNow(1000);
    h.join(guest);
    await h.flush();

    h.setNow(2000);
    account.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();

    const token = welcomeOf(account).token;
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const events = [...activityFrames(account), ...activityFrames(guest)].map(
      (frame) => frame.event,
    );
    const activityPayloads = [
      ...events,
      ...(welcomeOf(account).activity ?? []),
      ...(welcomeOf(guest).activity ?? []),
    ];
    expect(activityPayloads.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(activityPayloads);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain('account-9');
    expect(serialized).not.toContain('"token"');
    expect(serialized).not.toContain('accountId');
    expect(serialized).not.toContain('email');
    // The account id/token stay in the exempt welcome envelope, unchanged by the feed.
    expect(welcomeOf(account).identity).toEqual({
      kind: 'account',
      accountId: 'account-9',
      username: 'alice',
    });
  });

  it('leaves the 40 ms removal batching and 250 ms economy cadence unchanged (AC-14)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createFeedHarness({
      economy: repo,
      overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 },
    });
    const account = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(account);
    await h.flush();
    const guest = h.connect();
    h.join(guest);
    await h.flush();
    account.clear();
    guest.clear();

    explode(account, 'front:0:0', 0);
    h.advanceTimersOnly(39);
    expect(guest.messages()).toEqual([]);
    h.advanceTimersOnly(1);
    expect(guest.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
    guest.clear();

    // The accepted completion at 1000 ms flushes nothing pending and emits one activity event.
    for (const id of allIds(3).slice(1)) {
      explode(account, id, 0);
    }
    h.setNow(1000);
    account.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(activityFrames(account)).toEqual([
      fastActivity(2, 1000, 1, 'p1', 'alice', 1, 1000),
    ]);
    await h.flush();

    // The 250 ms economy coalescing still needs the full window after the activity event.
    account.clear();
    h.advanceTimersOnly(249);
    expect(account.messages().some((message) => message.type === 'economyUpdate')).toBe(false);
    h.advanceTimersOnly(1);
    expect(account.messages().filter((message) => message.type === 'economyUpdate')).toHaveLength(
      1,
    );

    // A removal enqueued after the activity still waits its own 40 ms window.
    guest.clear();
    explode(account, 'front:0:0', 1);
    h.advanceTimersOnly(39);
    expect(guest.messages()).toEqual([]);
    h.advanceTimersOnly(1);
    expect(guest.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
  });

  it('sends nothing after close and leaves the feed inert (AC-11/AC-25)', () => {
    const h = createFeedHarness({ overrides: { maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    h.hub.close();
    expect(h.hub.connectionCount()).toBe(0);

    first.receive(JSON.stringify({ type: 'join' }));
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    second.drop();
    h.advanceTimersOnly(30_000);
    h.hub.close();

    expect(first.messages()).toEqual([]);
    expect(second.messages()).toEqual([]);
    expect(activityFrames(first)).toEqual([]);
    expect(activityFrames(second)).toEqual([]);
  });
});

describe('server live leaderboard (server-live-leaderboard)', () => {
  interface LeaderboardHarnessOptions {
    overrides?: Partial<GameConfig>;
    economy?: InMemoryEconomyRepository;
    draw?: () => number;
  }

  /** A hub with a manual clock, fake timers, a metrics registry and an optional repository. */
  function createLeaderboardHarness(options: LeaderboardHarnessOptions = {}) {
    const config: GameConfig = { ...loadGameConfig({}), ...options.overrides };
    const metrics = createMetrics();
    let clock = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => options.draw ?? (() => 0),
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      metrics,
      ...(options.economy === undefined ? {} : { economy: options.economy }),
    });
    return {
      config,
      hub,
      metrics,
      clock: () => clock,
      setNow: (ms: number) => {
        clock = ms;
      },
      advance: (ms: number) => {
        clock += ms;
        vi.advanceTimersByTime(ms);
      },
      advanceTimersOnly: (ms: number) => {
        vi.advanceTimersByTime(ms);
      },
      connect: (session: AccountSession | null = null) => {
        const peer = new FakePeer();
        hub.attach(peer, session);
        return peer;
      },
      join: (peer: FakePeer) => {
        peer.receive(JSON.stringify({ type: 'join' }));
      },
      flush: async () => {
        for (let i = 0; i < 50; i += 1) {
          await Promise.resolve();
        }
      },
    };
  }

  type LeaderboardUpdateFrame = Extract<ServerMessage, { type: 'leaderboardUpdate' }>;

  /** Every `leaderboardUpdate` frame on `peer`, in arrival order. */
  function leaderboardFrames(peer: FakePeer): LeaderboardUpdateFrame[] {
    return peer
      .messages()
      .filter((message): message is LeaderboardUpdateFrame => message.type === 'leaderboardUpdate');
  }

  /** The snapshot on a placement frame; fails when the field is absent. */
  function leaderboardOf(message: { leaderboard?: LeaderboardSnapshot }): LeaderboardSnapshot {
    if (message.leaderboard === undefined) {
      throw new Error('expected a leaderboard snapshot');
    }
    return message.leaderboard;
  }

  /** The numeric value of one exact rendered sample (`name` or `name{labels}`), or `null`. */
  function sampleValue(metrics: Metrics, sample: string): number | null {
    const line = metrics
      .render()
      .split('\n')
      .find((candidate) => candidate.startsWith(`${sample} `));
    if (line === undefined) {
      return null;
    }
    return Number(line.slice(sample.length + 1));
  }

  function rotate(peer: FakePeer, yawSteps: number, pitchSteps: number): void {
    peer.receive(JSON.stringify({ type: 'rotate', yawSteps, pitchSteps }));
  }

  it('counts only accepted clicks and a face clear at the existing boundary (AC-1)', () => {
    const h = createLeaderboardHarness({
      overrides: { maxUsersPerServer: 2, clickRateLimitPerSecond: 3 },
    });
    const peer = h.connect();
    h.join(peer);
    const unjoined = h.connect();
    peer.clear();

    // An invalid click consumes its rate slot but never counts.
    explode(peer, 'front:9:9');
    expect(peer.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
    peer.clear();

    // An oversized frame and a pre-join frame never reach the counter path.
    peer.receive(
      JSON.stringify({ type: 'explode', id: 'front:0:0', level: 0, pad: 'x'.repeat(1100) }),
    );
    expect(peer.messages()).toEqual([{ type: 'error', code: 'bad_message' }]);
    unjoined.receive(JSON.stringify({ type: 'explode', id: 'front:0:0', level: 0 }));
    expect(unjoined.messages()).toEqual([{ type: 'error', code: 'not_joined' }]);
    peer.clear();

    // Two accepted clicks; the third is rate-limited and never counts.
    explode(peer, 'front:0:0');
    explode(peer, 'right:0:0');
    explode(peer, 'left:0:0');
    expect(sentTextsOfType(peer, 'error')).toEqual([
      '{"type":"error","code":"rate_limited"}',
    ]);
    flushRemovals(h);
    peer.clear();

    h.advance(1000);
    expect(leaderboardFrames(peer)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 1000,
          entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 2 }],
          totals: { cubesCompleted: 0, clicks: 2, facesDestroyed: 0 },
        },
      },
    ]);
  });

  it('increments facesDestroyed only once the whole face is removed (AC-1)', () => {
    const h = createLeaderboardHarness();
    const peer = h.connect();
    h.join(peer);
    const frontFace = allIds(3).slice(0, 9);

    for (const id of frontFace.slice(0, 8)) {
      explode(peer, id);
    }
    flushRemovals(h);
    peer.clear();
    h.advance(1000);

    expect(leaderboardFrames(peer)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 1000,
          entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 8 }],
          totals: { cubesCompleted: 0, clicks: 8, facesDestroyed: 0 },
        },
      },
    ]);

    // The ninth click clears the face: both counters move.
    peer.clear();
    explode(peer, frontFace[8]!);
    flushRemovals(h);
    peer.clear();
    h.advance(1000);
    expect(leaderboardFrames(peer)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 2000,
          entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 9 }],
          totals: { cubesCompleted: 0, clicks: 9, facesDestroyed: 1 },
        },
      },
    ]);
  });

  it('increments cubesCompleted once per accepted completion only (AC-2)', () => {
    const h = createLeaderboardHarness();
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    // An incomplete board and a wrong level change nothing.
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
    second.receive(JSON.stringify({ type: 'cubeCompleted', level: 3 }));
    expect(second.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p2',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
      },
    ]);
    first.clear();
    second.clear();

    // p1 clears a full 3×3 board (54 accepted clicks, 6 faces) and completes once.
    removeLevel(h, first, allIds(3));
    first.clear();
    second.clear();
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    first.clear();
    second.clear();

    h.advance(1000);
    expect(leaderboardFrames(second)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 2000,
          entries: [
            { playerId: 'p1', name: 'Player 1', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
      },
    ]);
  });

  it('ranks guests and accounts identically from the same accepted actions (AC-3)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createLeaderboardHarness({ economy: repo, overrides: { maxUsersPerServer: 2 } });
    const guest = h.connect();
    h.join(guest);
    await h.flush();
    const account = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(account);
    await h.flush();
    expect(welcomeOf(account).serverId).toBe(1);
    guest.clear();
    account.clear();

    explode(guest, 'front:0:0');
    explode(account, 'front:0:0');
    flushRemovals(h);
    guest.clear();
    account.clear();
    h.advance(1000);

    const expected: LeaderboardUpdateFrame = {
      type: 'leaderboardUpdate',
      leaderboard: {
        serverId: 1,
        at: 1000,
        entries: [
          { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 1 },
          { playerId: 'p2', name: 'alice', cubesCompleted: 0, clicks: 1 },
        ],
        totals: { cubesCompleted: 0, clicks: 2, facesDestroyed: 0 },
      },
    };
    expect(leaderboardFrames(guest)).toEqual([expected]);
    expect(leaderboardFrames(account)).toEqual([expected]);
  });

  it('carries one zero entry in a fresh welcome and the current ranking on rejoin (AC-7)', () => {
    const h = createLeaderboardHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connect();
    h.join(first);
    expect(welcomeOf(first).leaderboard).toEqual({
      serverId: 1,
      at: 0,
      entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 }],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });

    const second = h.connect();
    h.join(second);
    expect(welcomeOf(second).leaderboard).toEqual({
      serverId: 1,
      at: 0,
      entries: [
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 },
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
      ],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });

    const token = welcomeOf(first).token;
    explode(first, 'front:0:0');
    first.drop();
    // p2's accepted clicks happen while p1's socket is closed.
    explode(second, 'front:0:0');
    explode(second, 'front:0:1');
    h.setNow(500);
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(welcomeOf(resumed).leaderboard).toEqual({
      serverId: 1,
      at: 500,
      entries: [
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 2 },
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 1 },
      ],
      totals: { cubesCompleted: 0, clicks: 3, facesDestroyed: 0 },
    });
  });

  it('keeps a grace member ranked, then drops them and their totals on removal (AC-10)', () => {
    const h = createLeaderboardHarness({
      overrides: { maxUsersPerServer: 2, reconnectGraceMs: 1000 },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    h.advance(1000);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    explode(first, 'front:0:1');
    explode(second, 'right:0:0');
    first.clear();
    second.clear();

    // A socket close starts grace and marks nothing: no frame while the window is open.
    first.drop();
    h.advance(999);
    expect(leaderboardFrames(second)).toEqual([]);
    second.clear();

    // At the deadline the pending click flush runs first (p1 is still ranked), then the
    // expiry removes them and marks the server dirty for the next window.
    h.advance(1);
    expect(leaderboardFrames(second)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 2000,
          entries: [
            { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 2 },
            { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 1 },
          ],
          totals: { cubesCompleted: 0, clicks: 3, facesDestroyed: 0 },
        },
      },
    ]);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 2000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);

    second.clear();
    h.advance(1000);
    expect(leaderboardFrames(second)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 3000,
          entries: [{ playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 1 }],
          totals: { cubesCompleted: 0, clicks: 1, facesDestroyed: 0 },
        },
      },
    ]);
  });

  it('attributes a completion to the mover and drops the old server totals (AC-2/AC-8)', () => {
    const h = createLeaderboardHarness({
      overrides: {
        maxUsersPerServer: 2,
        reconnectGraceMs: 1000,
        clickRateLimitPerSecond: 1000,
      },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const third = h.connect();
    h.join(third);
    const fourth = h.connect();
    h.join(fourth);
    h.advance(1000);
    first.clear();
    second.clear();
    third.clear();
    fourth.clear();

    second.drop();
    h.advance(1000);
    first.clear();
    third.clear();
    fourth.clear();

    // p3 completes on server 2 and executes the planned move into server 1's free slot.
    removeLevel(h, third, allIds(3));
    first.clear();
    third.clear();
    fourth.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(leaderboardOf(onlyType(third, 'worldEntered'))).toEqual({
      serverId: 1,
      at: 3000,
      entries: [
        { playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 54 },
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 },
      ],
      totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
    });

    first.clear();
    third.clear();
    fourth.clear();
    h.advance(1000);

    // The target server's snapshot includes the completion; the old server's snapshot and
    // totals exclude the mover.
    expect(leaderboardFrames(first)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 4000,
          entries: [
            { playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 54 },
            { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 },
          ],
          totals: { cubesCompleted: 1, clicks: 54, facesDestroyed: 6 },
        },
      },
    ]);
    expect(leaderboardFrames(third)).toEqual(leaderboardFrames(first));
    expect(leaderboardFrames(fourth)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 2,
          at: 4000,
          entries: [{ playerId: 'p4', name: 'Player 4', cubesCompleted: 0, clicks: 0 }],
          totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
        },
      },
    ]);
  });

  it('publishes a join snapshot at 999 ms and the coalesced frame at 1000 ms (AC-9)', () => {
    const h = createLeaderboardHarness();
    const peer = h.connect();
    h.join(peer);
    peer.clear();

    h.advance(999);
    expect(leaderboardFrames(peer)).toEqual([]);

    h.advance(1);
    expect(leaderboardFrames(peer)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 1000,
          entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 }],
          totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
        },
      },
    ]);
  });

  it('coalesces ten accepted clicks into one frame and starts a new window after it (AC-9)', () => {
    const h = createLeaderboardHarness();
    const peer = h.connect();
    h.join(peer);
    // One id per face (then a second row) so ten clicks never clear a face.
    const ids = [
      'front:0:0',
      'right:0:0',
      'back:0:0',
      'left:0:0',
      'top:0:0',
      'bottom:0:0',
      'front:0:1',
      'right:0:1',
      'back:0:1',
      'left:0:1',
      'top:0:1',
    ];
    peer.clear();

    for (let index = 0; index < 10; index += 1) {
      if (index > 0) {
        h.advance(100);
      }
      explode(peer, ids[index]!);
    }
    expect(leaderboardFrames(peer)).toEqual([]);

    h.advance(100);
    const frames = leaderboardFrames(peer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({
      type: 'leaderboardUpdate',
      leaderboard: {
        serverId: 1,
        at: 1000,
        entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 10 }],
        totals: { cubesCompleted: 0, clicks: 10, facesDestroyed: 0 },
      },
    });

    peer.clear();
    h.advance(1);
    explode(peer, ids[10]!);
    h.advance(999);
    expect(leaderboardFrames(peer)).toEqual([]);
    h.advance(1);
    expect(leaderboardFrames(peer)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 2001,
          entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 11 }],
          totals: { cubesCompleted: 0, clicks: 11, facesDestroyed: 0 },
        },
      },
    ]);
  });

  it('publishes top five entries and totals over all current members (AC-5/AC-6)', () => {
    const h = createLeaderboardHarness({ overrides: { maxUsersPerServer: 6 } });
    const peers: FakePeer[] = [];
    for (let index = 0; index < 6; index += 1) {
      const peer = h.connect();
      h.join(peer);
      peers.push(peer);
    }
    h.advance(1000);
    for (const peer of peers) {
      peer.clear();
    }

    const ids = allIds(3);
    // p1 → 6 clicks, p2 → 5, …, p6 → 1: the top five omit p6 and its click still totals.
    peers.forEach((peer, index) => {
      const clicks = 6 - index;
      for (let count = 0; count < clicks; count += 1) {
        explode(peer, ids[count]!);
      }
    });
    h.advance(1000);

    const expected: LeaderboardUpdateFrame = {
      type: 'leaderboardUpdate',
      leaderboard: {
        serverId: 1,
        at: 2000,
        entries: [
          { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 6 },
          { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 5 },
          { playerId: 'p3', name: 'Player 3', cubesCompleted: 0, clicks: 4 },
          { playerId: 'p4', name: 'Player 4', cubesCompleted: 0, clicks: 3 },
          { playerId: 'p5', name: 'Player 5', cubesCompleted: 0, clicks: 2 },
        ],
        totals: { cubesCompleted: 0, clicks: 21, facesDestroyed: 0 },
      },
    };
    for (const peer of peers) {
      expect(leaderboardFrames(peer)).toEqual([expected]);
    }
  });

  it('encodes one frame once and fans the same bytes to every member with metrics (AC-11/AC-16)', () => {
    const h = createLeaderboardHarness({ overrides: { maxUsersPerServer: 2 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    const stringify = vi.spyOn(JSON, 'stringify');
    h.advance(1000);

    expect(encodeCallsFor(stringify, 'leaderboardUpdate')).toHaveLength(1);
    const expectedText =
      '{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":0,"clicks":0},{"playerId":"p2","name":"Player 2","cubesCompleted":0,"clicks":0}],"totals":{"cubesCompleted":0,"clicks":0,"facesDestroyed":0}}}';
    expect(sentTextsOfType(first, 'leaderboardUpdate')).toEqual([expectedText]);
    expect(sentTextsOfType(second, 'leaderboardUpdate')).toEqual([expectedText]);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="leaderboardUpdate"}'),
    ).toBe(1);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_frames_sent_total{type="leaderboardUpdate"}'),
    ).toBe(2);
  });

  it('keeps two servers isolated and addresses a snapshot to its own server (AC-12)', () => {
    const h = createLeaderboardHarness({ overrides: { maxUsersPerServer: 1 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    expect(welcomeOf(first).serverId).toBe(1);
    expect(welcomeOf(second).serverId).toBe(2);
    h.advance(1000);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    h.advance(1000);
    expect(leaderboardFrames(first)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 1,
          at: 2000,
          entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 1 }],
          totals: { cubesCompleted: 0, clicks: 1, facesDestroyed: 0 },
        },
      },
    ]);
    expect(leaderboardFrames(second)).toEqual([]);

    first.clear();
    second.clear();
    explode(second, 'front:0:0');
    h.advance(1000);
    expect(leaderboardFrames(second)).toEqual([
      {
        type: 'leaderboardUpdate',
        leaderboard: {
          serverId: 2,
          at: 3000,
          entries: [{ playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 1 }],
          totals: { cubesCompleted: 0, clicks: 1, facesDestroyed: 0 },
        },
      },
    ]);
    expect(leaderboardFrames(first)).toEqual([]);
  });

  it('emits nothing on a quiet server, a rotate or a rejoin (AC-10)', () => {
    const h = createLeaderboardHarness({ overrides: { maxUsersPerServer: 2 } });
    const peer = h.connect();
    h.join(peer);
    const token = welcomeOf(peer).token;
    h.advance(1000);
    peer.clear();

    h.advance(1000);
    expect(leaderboardFrames(peer)).toEqual([]);

    rotate(peer, 1, 0);
    h.advance(1000);
    expect(leaderboardFrames(peer)).toEqual([]);

    peer.drop();
    h.advance(500);
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));
    resumed.clear();
    h.advance(1000);
    expect(leaderboardFrames(resumed)).toEqual([]);
  });

  it('emits nothing for a purchase, a loot open or an equip (AC-10)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    await repo.grantCustomization('u1', { lootboxes: 1, keys: 1 });
    const h = createLeaderboardHarness({ economy: repo });
    const peer = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(peer);
    await h.flush();
    h.advance(1000);
    peer.clear();

    peer.receive(JSON.stringify({ type: 'purchaseUpgrade', upgradeId: 'mini_cube_value' }));
    await h.flush();
    peer.receive(JSON.stringify({ type: 'openLootbox' }));
    await h.flush();
    const reveal = onlyType(peer, 'lootboxOpened');
    peer.receive(JSON.stringify({ type: 'equipPart', partId: reveal.partId }));
    await h.flush();
    peer.receive(JSON.stringify({ type: 'unequipPart', slotId: reveal.slot }));
    await h.flush();

    expect(leaderboardFrames(peer)).toEqual([]);
    h.advance(1000);
    expect(leaderboardFrames(peer)).toEqual([]);
  });

  it('leaves the 40 ms removal and 250 ms economy paths unchanged (AC-11)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.creditWithRevision('u1', { coins: 100 });
    const h = createLeaderboardHarness({ economy: repo });
    const peer = h.connect({ userId: 'u1', username: 'alice', verified: true });
    h.join(peer);
    await h.flush();
    peer.clear();

    explode(peer, 'front:0:0');
    await h.flush();
    h.advanceTimersOnly(39);
    expect(
      peer
        .messages()
        .filter(
          (message) => message.type === 'miniCubeRemoved' || message.type === 'miniCubesRemoved',
        ),
    ).toEqual([]);
    h.advanceTimersOnly(1);
    expect(onlyType(peer, 'miniCubeRemoved')).toEqual({
      type: 'miniCubeRemoved',
      playerId: 'p1',
      id: 'front:0:0',
    });

    expect(sentTextsOfType(peer, 'economyUpdate')).toEqual([]);
    h.advanceTimersOnly(209);
    expect(sentTextsOfType(peer, 'economyUpdate')).toEqual([]);
    h.advanceTimersOnly(1);
    expect(sentTextsOfType(peer, 'economyUpdate')).toEqual([
      '{"type":"economyUpdate","coins":100.1,"clicks":1,"facesDestroyed":0,"cubesDestroyed":0}',
    ]);
    expect(leaderboardFrames(peer)).toEqual([]);
  });

  it('keeps every leaderboard counter and the token out of the snapshot frames (AC-24)', async () => {
    const repo = new InMemoryEconomyRepository();
    const h = createLeaderboardHarness({ economy: repo });
    const peer = h.connect({ userId: 'acct-secret-42', username: 'alice', verified: true });
    h.join(peer);
    await h.flush();
    const welcome = welcomeOf(peer);
    const token = welcome.token;

    expect(leaderboardOf(welcome)).toEqual({
      serverId: 1,
      at: 0,
      entries: [{ playerId: 'p1', name: 'alice', cubesCompleted: 0, clicks: 0 }],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });

    explode(peer, 'front:0:0');
    h.advance(1000);
    const updates = sentTextsOfType(peer, 'leaderboardUpdate');
    expect(updates).toHaveLength(1);
    expect(JSON.parse(updates[0]!)).toEqual({
      type: 'leaderboardUpdate',
      leaderboard: {
        serverId: 1,
        at: 1000,
        entries: [{ playerId: 'p1', name: 'alice', cubesCompleted: 0, clicks: 1 }],
        totals: { cubesCompleted: 0, clicks: 1, facesDestroyed: 0 },
      },
    });

    for (const text of [JSON.stringify(leaderboardOf(welcome)), ...updates]) {
      expect(text).not.toContain('acct-secret-42');
      expect(text).not.toContain(token);
      expect(text).not.toContain('coins');
      expect(text).not.toContain('economy');
      expect(text).not.toContain('accountId');
      expect(text).not.toContain('upgrades');
    }
  });

  it('drops a destroyed server timer on a last-member move and never flushes it (AC-13)', () => {
    const h = createLeaderboardHarness({
      overrides: {
        maxUsersPerServer: 2,
        reconnectGraceMs: 1000,
        clickRateLimitPerSecond: 1000,
      },
    });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const third = h.connect();
    h.join(third);
    expect(welcomeOf(third).serverId).toBe(2);
    h.advance(1000);
    first.clear();
    second.clear();
    third.clear();

    // p2's grace expires, leaving server 1 with one member and one planned donor (p3).
    second.drop();
    h.advance(1000);
    first.clear();
    third.clear();

    // p3 clears a full level (server 2 dirty) then completes into server 1: server 2 dies.
    for (const id of allIds(3)) {
      explode(third, id);
    }
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(leaderboardOf(onlyType(third, 'worldEntered')).serverId).toBe(1);

    // Exactly two heartbeats and server 1's single pending flush remain: the destroyed
    // server's click timer was dropped instead of surviving until its window.
    expect(vi.getTimerCount()).toBe(3);
    h.hub.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards every pending flush on close and never sends afterwards (AC-13)', () => {
    const h = createLeaderboardHarness({ overrides: { maxUsersPerServer: 1 } });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    explode(first, 'front:0:0');
    explode(second, 'front:0:0');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    h.hub.close();
    expect(vi.getTimerCount()).toBe(0);

    h.advance(1000);
    expect(leaderboardFrames(first)).toEqual([]);
    expect(leaderboardFrames(second)).toEqual([]);
    h.hub.close();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('explicit leave (presence-and-activity-liveness)', () => {
  /**
   * A fake peer whose hub-initiated `close()` closes the socket but withholds the transport
   * close event until the test emits it — the delayed-close window in which a heartbeat tick
   * could otherwise overwrite the deliberate close reason (F4).
   */
  class DelayedClosePeer extends FakePeer {
    override close(): void {
      this.closeCalls += 1;
      this.closed = true;
    }
  }

  /**
   * A hub with the metrics registry, a manual clock and fake timers. `connect` attaches a
   * fake peer (optionally with an account session), `join` sends the client frame and `leave`
   * sends the exact `{"type":"leave"}` frame.
   */
  function createLeaveHarness(overrides: Partial<GameConfig> = {}) {
    const config: GameConfig = { ...loadGameConfig({}), ...overrides };
    const metrics = createMetrics();
    let clock = 0;
    let counter = 0;
    const hub = createGameHub({
      config,
      now: () => clock,
      random: () => () => 0,
      timers: { setInterval, clearInterval, setTimeout, clearTimeout },
      metrics,
    });
    return {
      config,
      hub,
      metrics,
      connect(session: AccountSession | null = null): FakePeer {
        counter += 1;
        const peer = new FakePeer();
        hub.attach(peer, session, `req-${counter}`);
        return peer;
      },
      join(peer: FakePeer): void {
        peer.receive(JSON.stringify({ type: 'join' }));
      },
      advance(ms: number): void {
        clock += ms;
        vi.advanceTimersByTime(ms);
      },
      advanceTimersOnly(ms: number): void {
        vi.advanceTimersByTime(ms);
      },
      setNow(ms: number): void {
        clock = ms;
      },
    };
  }

  /** The numeric value of one exact rendered sample (`name` or `name{labels}`), or `null`. */
  function sampleValue(metrics: Metrics, sample: string): number | null {
    const line = metrics
      .render()
      .split('\n')
      .find((candidate) => candidate.startsWith(`${sample} `));
    if (line === undefined) {
      return null;
    }
    return Number(line.slice(sample.length + 1));
  }

  /** Sends the exact client `leave` frame. */
  function leave(peer: FakePeer): void {
    peer.receive(JSON.stringify({ type: 'leave' }));
  }

  it('removes the member immediately on leave, closes the peer and leaves no grace timer (AC-1)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(2);
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(1);
    // p1's heartbeat, p2's heartbeat and server 1's coalesced leaderboard timer.
    expect(vi.getTimerCount()).toBe(3);

    // Leave at 2000 ms opens the 1 s activity gate, so the final removal also records the
    // normal `memberLeft` candidate in addition to the protocol broadcast.
    h.setNow(2000);
    leave(first);

    // The leaver receives nothing; the survivor gets the protocol frame then the activity.
    expect(first.messages()).toEqual([]);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 2000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);
    // The hub closed the leaver's peer exactly once, with no grace timer for p1 remaining.
    expect(first.closeCalls).toBe(1);
    expect(first.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(2);
    expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(1);
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(1);

    // One full grace window later there is still exactly one `memberLeft` for p1: the final
    // removal already happened, so the grace path never runs for this member.
    h.advance(h.config.reconnectGraceMs);
    expect(
      messagesWithoutLeaderboard(second).filter((message) => message.type === 'memberLeft'),
    ).toEqual([{ type: 'memberLeft', playerId: 'p1', reason: 'left' }]);
    expect(first.messages()).toEqual([]);
  });

  it('keeps the accepted grace and resumes identity, cube and counters on rejoin (AC-2)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2, clickRateLimitPerSecond: 1000 });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const token = welcomeOf(first).token;

    // A clears a full 3x3 level (54 accepted clicks, 6 faces) without completing the cube.
    for (const id of allIds(3)) {
      explode(first, id);
    }
    flushRemovals(h);
    first.clear();
    second.clear();

    first.drop();
    expect(messagesWithoutLeaderboard(second)).toEqual([]);

    h.setNow(h.config.reconnectGraceMs - 1);
    h.advanceTimersOnly(h.config.reconnectGraceMs - 1);
    const resumed = h.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));
    const welcome = welcomeOf(resumed);

    expect(welcome.playerId).toBe('p1');
    expect(welcome.serverId).toBe(1);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.self).toEqual({
      levelIndex: 0,
      gridSize: 3,
      styleId: 'obsidian-neon',
      removedIds: allIds(3),
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1, {
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: allIds(3),
      }),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    // The resumed session counters travel on the `welcome` leaderboard snapshot.
    expect(welcome.leaderboard).toEqual({
      serverId: 1,
      at: 29_999,
      entries: [
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 54 },
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
      ],
      totals: { cubesCompleted: 0, clicks: 54, facesDestroyed: 6 },
    });
  });

  it('finalizes an unrejoined abrupt close exactly at the grace deadline and frees the slot (AC-2)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.drop();
    second.clear();

    h.setNow(h.config.reconnectGraceMs - 1);
    h.advanceTimersOnly(h.config.reconnectGraceMs - 1);
    expect(
      messagesWithoutLeaderboard(second).filter((message) => message.type === 'memberLeft'),
    ).toEqual([]);

    h.setNow(h.config.reconnectGraceMs);
    h.advanceTimersOnly(1);
    expect(messagesWithoutLeaderboard(second)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 30_000, 1, 'memberLeft', 'p1', 'Player 1'),
    ]);

    const joined = h.connect();
    h.join(joined);
    const welcome = welcomeOf(joined);
    expect(welcome.playerId).toBe('p3');
    expect(welcome.name).toBe('Player 3');
    expect(welcome.position).toEqual(X2_SLOT_1);
  });

  it('destroys the last member server immediately on leave and starts no grace (AC-4)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const only = h.connect();
    h.join(only);
    const token = welcomeOf(only).token;
    only.clear();

    // Only the member heartbeat and server 1's coalesced leaderboard timer exist.
    expect(vi.getTimerCount()).toBe(2);

    leave(only);

    expect(only.closeCalls).toBe(1);
    expect(only.messages()).toEqual([]); // no peer receives memberLeft or activityEvent
    expect(vi.getTimerCount()).toBe(0);
    expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(0);
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(0);

    // The token died with the member: resume fails; the next join creates server 2.
    const resume = h.connect();
    resume.receive(JSON.stringify({ type: 'rejoin', token }));
    expect(resume.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);

    const joined = h.connect();
    h.join(joined);
    expect(welcomeOf(joined).serverId).toBe(2);
  });

  it('keeps an abruptly closed last member server alive through the grace window (AC-4)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const only = h.connect();
    h.join(only);
    only.clear();

    only.drop();
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(1);
    h.setNow(h.config.reconnectGraceMs - 1);
    h.advanceTimersOnly(h.config.reconnectGraceMs - 1);
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(1);

    h.setNow(h.config.reconnectGraceMs);
    h.advanceTimersOnly(1);
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(0);
    expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(0);
    expect(only.messages()).toEqual([]);
  });

  it('fails rejoin after leave and creates a fresh member in the freed slot (AC-3)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    const firstToken = welcomeOf(first).token;
    first.clear();
    second.clear();

    leave(first);
    first.clear();

    const resume = h.connect();
    resume.receive(JSON.stringify({ type: 'rejoin', token: firstToken }));
    resume.receive(JSON.stringify({ type: 'rejoin', token: firstToken }));
    expect(resume.messages()).toEqual([
      { type: 'error', code: 'resume_failed' },
      { type: 'error', code: 'resume_failed' },
    ]);

    const joined = h.connect();
    h.join(joined);
    const welcome = welcomeOf(joined);
    expect(welcome.playerId).toBe('p3');
    expect(welcome.name).toBe('Player 3');
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.token).not.toBe(firstToken);
    expect(welcome.roster).toEqual([
      memberOf('p3', 'Player 3', X2_SLOT_1),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
  });

  it('rebuilds roster and leaderboard inputs from the surviving members after leave (AC-5)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2, clickRateLimitPerSecond: 1000 });
    const first = h.connect();
    h.join(first);
    const firstPosition = welcomeOf(first).position;
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    flushRemovals(h);
    first.clear();
    second.clear();
    leave(first);

    // The next coalesced snapshot (<= 1 s) drops A and recomputes totals from live members.
    h.advance(1000);
    expect(onlyType(second, 'leaderboardUpdate').leaderboard).toEqual({
      serverId: 1,
      at: 1000,
      entries: [{ playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 }],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });

    // C fills the freed slot 1; the roster and the welcome leaderboard are exactly [C, B].
    const third = h.connect();
    h.join(third);
    const welcome = welcomeOf(third);
    expect(firstPosition).toEqual(X2_SLOT_1);
    expect(welcome.playerId).toBe('p3');
    expect(welcome.position).toEqual(firstPosition);
    expect(welcome.roster).toEqual([
      memberOf('p3', 'Player 3', firstPosition),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    expect(welcome.leaderboard).toEqual({
      serverId: 1,
      at: 1000,
      entries: [
        { playerId: 'p3', name: 'Player 3', cubesCompleted: 0, clicks: 0 },
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 0, clicks: 0 },
      ],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });
  });

  it('leaves only the sending tab and keeps the account other tab playing (AC-6)', () => {
    const session: AccountSession = { userId: 'u1', username: 'alice', verified: true };
    const h = createLeaveHarness({ maxUsersPerServer: 3, clickRateLimitPerSecond: 1000 });
    const firstTab = h.connect(session);
    h.join(firstTab);
    const secondTab = h.connect(session);
    h.join(secondTab);
    expect(welcomeOf(firstTab).playerId).toBe('p1');
    expect(welcomeOf(secondTab).playerId).toBe('p2');
    firstTab.clear();
    secondTab.clear();

    h.setNow(2000);
    explode(firstTab, 'front:0:0');
    flushRemovals(h);
    firstTab.clear();
    secondTab.clear();

    leave(firstTab);

    expect(firstTab.closeCalls).toBe(1);
    expect(secondTab.closed).toBe(false);
    expect(messagesWithoutLeaderboard(secondTab)).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
      transitionActivity(2, 2000, 1, 'memberLeft', 'p1', 'alice'),
    ]);

    // The next coalesced snapshot has one row for the account's live tab, excluding the leaver.
    h.advance(1000);
    const snapshot = onlyType(secondTab, 'leaderboardUpdate').leaderboard;
    expect(snapshot.entries).toEqual([
      { playerId: 'p2', name: 'alice', cubesCompleted: 0, clicks: 0 },
    ]);
    expect(snapshot.totals).toEqual({ cubesCompleted: 0, clicks: 0, facesDestroyed: 0 });

    // The surviving tab is still joined: an accepted click is broadcast back to it.
    secondTab.clear();
    explode(secondTab, 'front:0:0');
    flushRemovals(h);
    expect(secondTab.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p2', id: 'front:0:0' },
    ]);
  });

  it('counts the leave frame and the client close reason exactly once (AC-9)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);

    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="client"}'),
    ).toBeNull();

    leave(first);

    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_received_total{type="leave"}'),
    ).toBe(1);
    expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(1);
    expect(sampleValue(h.metrics, 'cubeclicker_servers_active')).toBe(1);
    expect(sampleValue(h.metrics, 'cubeclicker_ws_connections_open')).toBe(1);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="client"}'),
    ).toBe(1);
    // No server message type `leave` was added: the encoded allow-list never sees it.
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_messages_encoded_total{type="leave"}'),
    ).toBeNull();
  });

  it('keeps the client close reason when a heartbeat tick fires before the close event (AC-9)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    // The transport close is delayed: the socket is closed but its close event is withheld.
    const first = new DelayedClosePeer();
    h.hub.attach(first, null, 'req-delayed');
    h.join(first);
    const second = h.connect();
    h.join(second);
    first.clear();
    second.clear();

    leave(first);
    expect(first.closeCalls).toBe(1);

    // Without the heartbeat clear, this tick would see the closed peer and call
    // terminate('heartbeat'), overwriting the deliberate `client` reason before the close.
    h.advance(h.config.heartbeatIntervalMs);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="heartbeat"}'),
    ).toBeNull();
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="client"}'),
    ).toBeNull();

    // The delayed close event finally arrives: it is counted exactly once as a client close.
    first.drop();
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="client"}'),
    ).toBe(1);
    expect(
      sampleValue(h.metrics, 'cubeclicker_ws_connections_closed_total{reason="heartbeat"}'),
    ).toBeNull();
    expect(first.closeCalls).toBe(1);
  });

  it('rejects leave from a connection that never joined and removes nothing (AC-8)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2 });
    const joined = h.connect();
    h.join(joined);
    const stranger = h.connect();
    joined.clear();
    stranger.clear();

    leave(stranger);

    expect(stranger.messages()).toEqual([{ type: 'error', code: 'not_joined' }]);
    expect(stranger.closed).toBe(false);
    expect(stranger.closeCalls).toBe(0);
    expect(sampleValue(h.metrics, 'cubeclicker_members_active')).toBe(1);
    expect(joined.messages()).toEqual([]);

    // The joined member is untouched: an accepted click still works.
    explode(joined, 'front:0:0');
    flushRemovals(h);
    expect(joined.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
  });

  it('carries only unexpired events on welcome across the 4999/5000 boundary (AC-13)', () => {
    // At 4999 both events (at 0 and at 1000) are younger than 5000 ms and travel.
    const before = createLeaveHarness({ maxUsersPerServer: 2 });
    const beforeFirst = before.connect();
    before.join(beforeFirst);
    before.setNow(1000);
    const beforeSecond = before.connect();
    before.join(beforeSecond);
    const beforeToken = welcomeOf(beforeFirst).token;
    beforeFirst.drop();
    before.setNow(4999);
    const beforeResumed = before.connect();
    beforeResumed.receive(JSON.stringify({ type: 'rejoin', token: beforeToken }));
    expect(welcomeOf(beforeResumed).activity).toEqual([
      transitionActivity(2, 1000, 1, 'memberJoined', 'p2', 'Player 2').event,
      transitionActivity(1, 0, 1, 'memberJoined', 'p1', 'Player 1').event,
    ]);

    // At exactly 5000 the `at: 0` event is expired, so only the 1000 event travels.
    const after = createLeaveHarness({ maxUsersPerServer: 2 });
    const afterFirst = after.connect();
    after.join(afterFirst);
    after.setNow(1000);
    const afterSecond = after.connect();
    after.join(afterSecond);
    const afterToken = welcomeOf(afterFirst).token;
    afterFirst.drop();
    after.setNow(5000);
    const afterResumed = after.connect();
    afterResumed.receive(JSON.stringify({ type: 'rejoin', token: afterToken }));
    expect(welcomeOf(afterResumed).activity).toEqual([
      transitionActivity(2, 1000, 1, 'memberJoined', 'p2', 'Player 2').event,
    ]);

    // At 6000 the 1000 event is 5000 ms old too: a fresh join seeds no activity.
    after.setNow(6000);
    const fresh = after.connect();
    after.join(fresh);
    expect(welcomeOf(fresh).activity).toEqual([]);
  });

  it('carries only the target server unexpired events on worldEntered (AC-13)', () => {
    const h = createLeaveHarness({ maxUsersPerServer: 2, clickRateLimitPerSecond: 1000 });
    const first = h.connect();
    h.join(first);
    const second = h.connect();
    h.join(second);
    // Server 1: p1's `at: 0` join. Server 2 gets p3's fresh 1000 ms join below.
    h.setNow(1000);
    const third = h.connect();
    h.join(third);
    expect(welcomeOf(third).serverId).toBe(2);
    leave(first);
    first.clear();
    second.clear();
    third.clear();

    // p3's completion at 5500 executes the planned move into server 1. The target snapshot
    // contains only its fresh 1000 ms `memberLeft`; its 0 ms join is expired, and server 2's
    // fresh 1000 ms join is not the target server's event.
    for (const id of allIds(3)) {
      explode(third, id);
    }
    flushRemovals(h);
    third.clear();
    h.setNow(5500);
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(onlyType(third, 'worldEntered').activity).toEqual([
      transitionActivity(2, 1000, 1, 'memberLeft', 'p1', 'Player 1').event,
    ]);
  });
});
